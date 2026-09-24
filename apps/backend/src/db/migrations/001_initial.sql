CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,

    username VARCHAR(100) NOT NULL UNIQUE,

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_role_check
        CHECK (
            role IN (
                'admin',
                'editor',
                'viewer',
                'pending'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);


-- =========================================================
-- CLIENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL UNIQUE,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- VIEWS
-- =========================================================

CREATE TABLE IF NOT EXISTS views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL UNIQUE,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- METADATA
-- =========================================================

CREATE TABLE IF NOT EXISTS metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id UUID NOT NULL,

    view_id UUID NOT NULL,

    name VARCHAR(500) NOT NULL,

    annotation_type VARCHAR(30) NOT NULL,

    annotations JSONB NOT NULL DEFAULT '[]'::jsonb,

    image_hash CHAR(64) NOT NULL,

    root_folders TEXT[] NOT NULL DEFAULT '{}',

    original_root_folders TEXT[] NOT NULL DEFAULT '{}',

    source_locations TEXT[] NOT NULL DEFAULT '{}',

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT metadata_client_fk
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE RESTRICT,

    CONSTRAINT metadata_view_fk
        FOREIGN KEY (view_id)
        REFERENCES views(id)
        ON DELETE RESTRICT,

    CONSTRAINT metadata_annotation_type_check
        CHECK (
            annotation_type IN (
                'bbox',
                'polygon',
                'segmentation'
            )
        ),

    CONSTRAINT metadata_annotations_array_check
        CHECK (
            jsonb_typeof(annotations) = 'array'
        ),

    CONSTRAINT metadata_image_hash_check
        CHECK (
            image_hash ~ '^[a-fA-F0-9]{64}$'
        ),

    CONSTRAINT metadata_unique_image
        UNIQUE (
            client_id,
            view_id,
            name
        )
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_metadata_client
    ON metadata(client_id);

CREATE INDEX IF NOT EXISTS idx_metadata_view
    ON metadata(view_id);

CREATE INDEX IF NOT EXISTS idx_metadata_annotation_type
    ON metadata(annotation_type);

CREATE INDEX IF NOT EXISTS idx_metadata_image_hash
    ON metadata(image_hash);

CREATE INDEX IF NOT EXISTS idx_metadata_name
    ON metadata(name);

CREATE INDEX IF NOT EXISTS idx_metadata_annotations
    ON metadata
    USING GIN(annotations);


-- =========================================================
-- UPDATED_AT FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

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