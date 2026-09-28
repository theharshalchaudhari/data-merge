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
    client_id UUID NOT NULL
        REFERENCES clients(id)
        ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT views_client_name_unique
        UNIQUE (client_id, name)
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

CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id INTEGER NOT NULL UNIQUE,
    class_name TEXT NOT NULL UNIQUE,
    CONSTRAINT classes_class_id_non_negative
        CHECK (class_id >= 0),
    CONSTRAINT classes_class_name_not_empty
        CHECK (length(trim(class_name)) > 0)
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
                'background_images'
            )
        ),
    annotations JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_hash CHAR(64) NOT NULL,
    root_folders TEXT[] NOT NULL DEFAULT '{}',
    original_root_folders TEXT[] NOT NULL DEFAULT '{}',
    source_locations TEXT[] NOT NULL DEFAULT '{}',
    description TEXT,
    CONSTRAINT metadata_client_view_name_unique
        UNIQUE (client_id, view_id, name)
);

CREATE INDEX IF NOT EXISTS idx_views_client_id
    ON views(client_id);

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

DROP TRIGGER IF EXISTS users_updated_at ON users;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS clients_updated_at ON clients;

CREATE TRIGGER clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS views_updated_at ON views;

CREATE TRIGGER views_updated_at
BEFORE UPDATE ON views
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

INSERT INTO classes (
    class_id,
    class_name
)
VALUES
    (0, 'Person'),
    (1, 'helmet'),
    (2, 'face_uncover'),
    (3, 'pagdi'),
    (4, 'fire'),
    (5, 'weapon'),
    (6, 'knife'),
    (7, 'UPS'),
    (8, 'Cylinder'),
    (9, 'bags'),
    (10, 'Handbags'),
    (11, 'Suitcase'),
    (12, 'cartons'),
    (13, 'Batteries'),
    (14, 'mask'),
    (15, 'burka'),
    (16, 'cap'),
    (17, 'scarf'),
    (18, 'others')
ON CONFLICT (class_id)
DO UPDATE SET
    class_name = EXCLUDED.class_name;


CREATE TABLE IF NOT EXISTS dataset_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dataset_type_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_type_id UUID NOT NULL
        REFERENCES dataset_types(id)
        ON DELETE CASCADE,
    class_id INTEGER NOT NULL,
    class_name TEXT NOT NULL,
    global_class_id INTEGER,
    UNIQUE (dataset_type_id, class_id),
    UNIQUE (dataset_type_id, class_name)
);

ALTER TABLE dataset_type_classes
ADD COLUMN IF NOT EXISTS global_class_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_dataset_type_classes_type
    ON dataset_type_classes(dataset_type_id);

CREATE INDEX IF NOT EXISTS idx_dataset_type_classes_global
    ON dataset_type_classes(global_class_id);

CREATE TABLE IF NOT EXISTS dataset_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL
        REFERENCES clients(id)
        ON DELETE RESTRICT,
    view_id UUID NOT NULL
        REFERENCES views(id)
        ON DELETE RESTRICT,
    uploaded_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,
    dataset_type_id UUID NOT NULL
        REFERENCES dataset_types(id)
        ON DELETE RESTRICT,
    folder_name TEXT NOT NULL,
    raw_folder_path TEXT NOT NULL,
    file_count INTEGER NOT NULL DEFAULT 0,
    image_count INTEGER NOT NULL DEFAULT 0,
    annotation_file_count INTEGER NOT NULL DEFAULT 0,
    annotation_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (
            status IN (
                'completed',
                'failed'
            )
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dataset_uploads_client
    ON dataset_uploads(client_id);

CREATE INDEX IF NOT EXISTS idx_dataset_uploads_view
    ON dataset_uploads(view_id);

CREATE INDEX IF NOT EXISTS idx_dataset_uploads_uploaded_by
    ON dataset_uploads(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_dataset_uploads_dataset_type
    ON dataset_uploads(dataset_type_id);

CREATE INDEX IF NOT EXISTS idx_dataset_uploads_created_at
    ON dataset_uploads(created_at DESC);


INSERT INTO dataset_types (
    name,
    description
)
VALUES
    (
        'weapon',
        'Weapon dataset: weapon, knife, fire'
    ),
    (
        '8_class',
        '8-class dataset'
    ),
    (
        '16_class',
        '16-class dataset'
    ),
    (
        '19_class',
        'Canonical 19-class dataset'
    )
ON CONFLICT (name)
DO UPDATE SET
    description = EXCLUDED.description;


INSERT INTO dataset_type_classes (
    dataset_type_id,
    class_id,
    class_name,
    global_class_id
)
SELECT
    dt.id,
    v.class_id,
    v.class_name,
    v.global_class_id
FROM dataset_types dt
CROSS JOIN (
    VALUES
        (0, 'weapon', 5),
        (1, 'knife', 6),
        (2, 'fire', 4)
) AS v(
    class_id,
    class_name,
    global_class_id
)
WHERE dt.name = 'weapon'
ON CONFLICT (dataset_type_id, class_id)
DO UPDATE SET
    class_name = EXCLUDED.class_name,
    global_class_id = EXCLUDED.global_class_id;


INSERT INTO dataset_type_classes (
    dataset_type_id,
    class_id,
    class_name,
    global_class_id
)
SELECT
    dt.id,
    v.class_id,
    v.class_name,
    v.global_class_id
FROM dataset_types dt
CROSS JOIN (
    VALUES
        (0, 'helmet', 1),
        (1, 'mask', 14),
        (2, 'face_uncover', 2),
        (3, 'pagdi', 3),
        (4, 'burka', 15),
        (5, 'cap', 16),
        (6, 'scarf', 17),
        (7, 'others', 18)
) AS v(
    class_id,
    class_name,
    global_class_id
)
WHERE dt.name = '8_class'
ON CONFLICT (dataset_type_id, class_id)
DO UPDATE SET
    class_name = EXCLUDED.class_name,
    global_class_id = EXCLUDED.global_class_id;


INSERT INTO dataset_type_classes (
    dataset_type_id,
    class_id,
    class_name,
    global_class_id
)
SELECT
    dt.id,
    v.class_id,
    v.class_name,
    v.global_class_id
FROM dataset_types dt
CROSS JOIN (
    VALUES
        (0, 'Person', 0),
        (1, 'helmet', 1),
        (2, 'face_uncover', 2),
        (3, 'pagdi', 3),
        (4, 'fire', 4),
        (5, 'weapon', 5),
        (6, 'knife', 6),
        (7, 'UPS', 7),
        (8, 'Cylinder', 8),
        (9, 'bags', 9),
        (10, 'Handbags', 10),
        (11, 'Suitcase', 11),
        (12, 'cartons', 12),
        (13, 'Batteries', 13),
        (14, 'mask', 14),
        (15, 'burka', 15)
) AS v(
    class_id,
    class_name,
    global_class_id
)
WHERE dt.name = '16_class'
ON CONFLICT (dataset_type_id, class_id)
DO UPDATE SET
    class_name = EXCLUDED.class_name,
    global_class_id = EXCLUDED.global_class_id;


INSERT INTO dataset_type_classes (
    dataset_type_id,
    class_id,
    class_name,
    global_class_id
)
SELECT
    dt.id,
    v.class_id,
    v.class_name,
    v.global_class_id
FROM dataset_types dt
CROSS JOIN (
    VALUES
        (0, 'Person', 0),
        (1, 'helmet', 1),
        (2, 'face_uncover', 2),
        (3, 'pagdi', 3),
        (4, 'fire', 4),
        (5, 'weapon', 5),
        (6, 'knife', 6),
        (7, 'UPS', 7),
        (8, 'Cylinder', 8),
        (9, 'bags', 9),
        (10, 'Handbags', 10),
        (11, 'Suitcase', 11),
        (12, 'cartons', 12),
        (13, 'Batteries', 13),
        (14, 'mask', 14),
        (15, 'burka', 15),
        (16, 'cap', 16),
        (17, 'scarf', 17),
        (18, 'others', 18)
) AS v(
    class_id,
    class_name,
    global_class_id
)
WHERE dt.name = '19_class'
ON CONFLICT (dataset_type_id, class_id)
DO UPDATE SET
    class_name = EXCLUDED.class_name,
    global_class_id = EXCLUDED.global_class_id;


ALTER TABLE dataset_type_classes
DROP CONSTRAINT IF EXISTS dataset_type_classes_global_class_id_fkey;

ALTER TABLE dataset_type_classes
ADD CONSTRAINT dataset_type_classes_global_class_id_fkey
FOREIGN KEY (global_class_id)
REFERENCES classes(class_id)
ON UPDATE CASCADE
ON DELETE RESTRICT;


UPDATE dataset_type_classes
SET global_class_id = classes.class_id
FROM classes
WHERE dataset_type_classes.class_name =
      classes.class_name
  AND dataset_type_classes.global_class_id IS NULL;


SELECT
    dt.name AS dataset_type,
    dtc.class_id AS source_class_id,
    dtc.class_name,
    dtc.global_class_id
FROM dataset_type_classes dtc
JOIN dataset_types dt
    ON dt.id = dtc.dataset_type_id
ORDER BY
    dt.name,
    dtc.class_id;