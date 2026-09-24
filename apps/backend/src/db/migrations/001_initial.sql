CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            role IN (
                'admin',
                'editor',
                'viewer',
                'pending'
            )
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL
        REFERENCES clients(id)
        ON DELETE RESTRICT,
    view_id UUID NOT NULL
        REFERENCES views(id)
        ON DELETE RESTRICT,
    name TEXT NOT NULL,
    annotation_type TEXT NOT NULL
        CHECK (
            annotation_type IN (
                'bbox',
                'polygon',
                'segmentation'
            )
        ),
    annotations JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_hash CHAR(64) NOT NULL,
    root_folders TEXT[] NOT NULL DEFAULT '{}',
    original_root_folders TEXT[] NOT NULL DEFAULT '{}',
    source_locations TEXT[] NOT NULL DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT metadata_client_view_name_unique
        UNIQUE (
            client_id,
            view_id,
            name
        )
);

CREATE INDEX IF NOT EXISTS idx_metadata_client_id
    ON metadata(client_id);

CREATE INDEX IF NOT EXISTS idx_metadata_view_id
    ON metadata(view_id);

CREATE INDEX IF NOT EXISTS idx_metadata_image_hash
    ON metadata(image_hash);

CREATE INDEX IF NOT EXISTS idx_metadata_name
    ON metadata(name);

CREATE INDEX IF NOT EXISTS idx_metadata_annotation_type
    ON metadata(annotation_type);

CREATE INDEX IF NOT EXISTS idx_metadata_annotations
    ON metadata USING GIN(annotations);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
    ON sessions(expires_at);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at
ON users;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS clients_updated_at
ON clients;

CREATE TRIGGER clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS views_updated_at
ON views;

CREATE TRIGGER views_updated_at
BEFORE UPDATE ON views
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS metadata_updated_at
ON metadata;

CREATE TRIGGER metadata_updated_at
BEFORE UPDATE ON metadata
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();