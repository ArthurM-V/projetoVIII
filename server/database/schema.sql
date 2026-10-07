PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS endereco (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logradouro TEXT NOT NULL,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    cep TEXT NOT NULL,
    latitude REAL,
    longitude REAL
);

CREATE TABLE IF NOT EXISTS usuario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    telefone TEXT,
    cep_localizacao TEXT,
    endereco_id INTEGER,
    FOREIGN KEY (endereco_id)
        REFERENCES endereco(id)
);

CREATE TABLE IF NOT EXISTS instituicao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    cnpj TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    telefone TEXT,
    foto_perfil_url TEXT,
    foto_capa_url TEXT,
    endereco_id INTEGER,
    FOREIGN KEY (endereco_id)
        REFERENCES endereco(id)
);

CREATE TABLE IF NOT EXISTS categoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT
);

CREATE TABLE IF NOT EXISTS instituicao_categoria (
    instituicao_id INTEGER NOT NULL,
    categoria_id INTEGER NOT NULL,

    PRIMARY KEY (instituicao_id, categoria_id),

    FOREIGN KEY (instituicao_id)
        REFERENCES instituicao(id)
        ON DELETE CASCADE,

    FOREIGN KEY (categoria_id)
        REFERENCES categoria(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS demanda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instituicao_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    imagem_url TEXT,
    tipo TEXT NOT NULL,
    classificacao TEXT NOT NULL DEFAULT 'pontual',
    quantidade_necessaria REAL,
    status TEXT NOT NULL DEFAULT 'ativa',
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (instituicao_id)
        REFERENCES instituicao(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS doacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    demanda_id INTEGER NOT NULL,
    quantidade REAL,
    data_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'registrada',

    FOREIGN KEY (usuario_id)
        REFERENCES usuario(id)
        ON DELETE CASCADE,

    FOREIGN KEY (demanda_id)
        REFERENCES demanda(id)
        ON DELETE CASCADE
);
