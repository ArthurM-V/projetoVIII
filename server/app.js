const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const environmentFile = path.resolve(__dirname, "../.env");
if (typeof process.loadEnvFile === "function" && fs.existsSync(environmentFile)) {
  process.loadEnvFile(environmentFile);
}
const db = require("./database/database");

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";
const demoMode = process.env.DEMO_MODE !== "false";
const sessionSecret = process.env.SESSION_SECRET || "development-only-session-secret";
const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET deve ser definido em produção.");
}

app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || clientOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origem não permitida."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));
app.use((req, res, next) => {
  if (isProduction && !req.secure) {
    return res.status(400).json({ message: "Use uma conexão HTTPS." });
  }
  return next();
});
app.use(express.json());

function ensureColumn(table, column, definition) {
  db.all(`PRAGMA table_info(${table})`, (error, columns) => {
    if (error || columns.some((item) => item.name === column)) return;
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  });
}

ensureColumn("instituicao", "descricao", "TEXT");
ensureColumn("demanda", "imagem_url", "TEXT");
ensureColumn("usuario", "senha_hash", "TEXT");
ensureColumn("instituicao", "senha_hash", "TEXT");
ensureColumn("usuario", "cep_localizacao", "TEXT");
ensureColumn("endereco", "latitude", "REAL");
ensureColumn("endereco", "longitude", "REAL");
ensureColumn("instituicao", "foto_perfil_url", "TEXT");
ensureColumn("instituicao", "foto_capa_url", "TEXT");
ensureColumn("demanda", "classificacao", "TEXT NOT NULL DEFAULT 'pontual'");

function isValidPassword(password) {
  return typeof password === "string"
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[^A-Za-z0-9\s]/.test(password);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function passwordMatches(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  const derivedHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const storedBuffer = Buffer.from(hash, "hex");
  const derivedBuffer = Buffer.from(derivedHash, "hex");
  return storedBuffer.length === derivedBuffer.length && crypto.timingSafeEqual(storedBuffer, derivedBuffer);
}

function createSession(account) {
  const payload = Buffer.from(JSON.stringify({
    id: account.id,
    perfil: account.perfil,
    expiresAt: Date.now() + (8 * 60 * 60 * 1000),
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(name.length + 1)) : null;
}

function readSession(req) {
  const token = readCookie(req, "laco_session");
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expectedSignature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function requireAuthentication(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ message: "Faça login para continuar." });
  req.auth = session;
  return next();
}

function requireInstitutionOwner(req, res, next) {
  if (req.auth.perfil !== "instituicao" || String(req.auth.id) !== String(req.params.id)) {
    return res.status(403).json({ message: "Você não tem permissão para esta instituição." });
  }
  return next();
}

function requireUser(req, res, next) {
  if (req.auth.perfil !== "usuario") return res.status(403).json({ message: "Ação restrita a usuários doadores." });
  return next();
}

function requireDemandOwner(req, res, next) {
  if (req.auth.perfil !== "instituicao") return res.status(403).json({ message: "Ação restrita a instituições." });
  db.get("SELECT instituicao_id FROM demanda WHERE id = ?", [req.params.id], (error, demand) => {
    if (error) return res.status(500).json({ message: "Não foi possível validar a permissão." });
    if (!demand) return res.status(404).json({ message: "Demanda não encontrada." });
    if (String(demand.instituicao_id) !== String(req.auth.id)) {
      return res.status(403).json({ message: "Você não tem permissão para esta demanda." });
    }
    return next();
  });
}

const loginAttempts = new Map();
function limitLoginAttempts(req, res, next) {
  const key = `${req.ip}:${String(req.body?.identificador || "").trim().toLowerCase()}`;
  const now = Date.now();
  const current = loginAttempts.get(key) || { count: 0, resetAt: now + (15 * 60 * 1000) };
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + (15 * 60 * 1000);
  }
  if (current.count >= 5) {
    return res.status(429).json({ message: "Muitas tentativas. Tente novamente em alguns minutos." });
  }
  current.count += 1;
  loginAttempts.set(key, current);
  res.locals.loginAttemptKey = key;
  return next();
}

function clearLoginAttempts(res) {
  loginAttempts.delete(res.locals.loginAttemptKey);
}

function blockRegistrationsInDemo(req, res, next) {
  if (demoMode) return res.status(403).json({ message: "Cadastros estão desativados no modo de demonstração." });
  return next();
}

app.get("/api/hello", (req, res) => {
  res.json({ message: "Por enquanto ta tudo tranquilo" });
});

app.get("/api/categorias", (_req, res) => {
  db.all("SELECT id, nome, descricao FROM categoria ORDER BY nome", (error, categorias) => {
    if (error) return res.status(500).json({ message: "Não foi possível carregar as categorias." });
    res.json(categorias);
  });
});

app.get("/api/mapa/config", (_req, res) => {
  if (!process.env.MAPS_API_KEY) {
    return res.status(503).json({ message: "A chave do mapa não está configurada." });
  }
  return res.json({ mapsApiKey: process.env.MAPS_API_KEY });
});

app.post("/api/login", limitLoginAttempts, (req, res) => {
  const { identificador, senha } = req.body;
  if (!identificador || !senha) return res.status(400).json({ message: "Informe seu e-mail, CPF ou CNPJ e a senha." });
  if (!isValidPassword(senha)) {
    return res.status(400).json({ message: "A senha deve ter ao menos 8 caracteres, uma letra maiúscula e um caractere especial." });
  }

  const lookup = String(identificador).trim();
  db.get(
    `SELECT id, nome, senha_hash, 'usuario' AS perfil FROM usuario WHERE email = ? OR cpf = ?
     UNION ALL
     SELECT id, nome, senha_hash, 'instituicao' AS perfil FROM instituicao WHERE email = ? OR cnpj = ?
     LIMIT 1`,
    [lookup, lookup, lookup, lookup],
    (error, account) => {
      if (error) return res.status(500).json({ message: "Não foi possível validar o acesso." });
      if (!account || !passwordMatches(senha, account.senha_hash)) {
        return res.status(401).json({ message: "Dados de acesso inválidos." });
      }
      clearLoginAttempts(res);
      const session = createSession(account);
      const cookieOptions = ["HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=28800"];
      if (isProduction) cookieOptions.push("Secure");
      res.setHeader("Set-Cookie", `laco_session=${encodeURIComponent(session)}; ${cookieOptions.join("; ")}`);
      res.json({ id: account.id, nome: account.nome, perfil: account.perfil });
    },
  );
});

app.get("/api/sessao", requireAuthentication, (req, res) => {
  res.json({ id: req.auth.id, perfil: req.auth.perfil });
});

app.post("/api/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "laco_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  res.status(204).end();
});

app.get("/api/meu-perfil", requireAuthentication, requireUser, (req, res) => {
  db.get(
    "SELECT id, nome, email, telefone, cep_localizacao FROM usuario WHERE id = ?",
    [req.auth.id],
    (error, user) => {
      if (error) return res.status(500).json({ message: "Não foi possível carregar o perfil." });
      if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
      return res.json(user);
    },
  );
});

app.put("/api/meu-perfil", requireAuthentication, requireUser, (req, res) => {
  const { nome, email, telefone, cep } = req.body;
  const normalizedCep = String(cep || "").replace(/\D/g, "");
  if (!nome || !email || normalizedCep.length !== 8) {
    return res.status(400).json({ message: "Informe nome, e-mail e um CEP válido." });
  }
  db.run(
    "UPDATE usuario SET nome = ?, email = ?, telefone = ?, cep_localizacao = ? WHERE id = ?",
    [nome, email, telefone || null, normalizedCep, req.auth.id],
    function updateUser(error) {
      if (error) {
        const message = error.code?.includes("UNIQUE") ? "Este e-mail já está em uso." : "Não foi possível atualizar o perfil.";
        return res.status(400).json({ message });
      }
      if (!this.changes) return res.status(404).json({ message: "Usuário não encontrado." });
      return res.json({ message: "Perfil atualizado." });
    },
  );
});

app.get("/api/minhas-doacoes", requireAuthentication, requireUser, (req, res) => {
  db.all(
    `SELECT doacao.id, doacao.status, doacao.data_registro, demanda.titulo AS demanda_titulo,
      demanda.tipo AS demanda_tipo, demanda.classificacao AS demanda_classificacao,
      instituicao.id AS instituicao_id, instituicao.nome AS instituicao_nome
      FROM doacao
      INNER JOIN demanda ON demanda.id = doacao.demanda_id
      INNER JOIN instituicao ON instituicao.id = demanda.instituicao_id
      WHERE doacao.usuario_id = ?
      ORDER BY doacao.data_registro DESC`,
    [req.auth.id],
    (error, donations) => {
      if (error) return res.status(500).json({ message: "Não foi possível carregar o histórico." });
      return res.json(donations);
    },
  );
});

app.post("/api/usuarios", blockRegistrationsInDemo, (req, res) => {
  const { nome, cpf, email, telefone, senha, cep } = req.body;
  const normalizedCep = String(cep || "").replace(/\D/g, "");

  if (!nome || !cpf || !email || normalizedCep.length !== 8) {
    return res.status(400).json({ message: "Preencha os campos obrigatórios e informe um CEP válido." });
  }
  if (!isValidPassword(senha)) {
    return res.status(400).json({ message: "A senha deve ter ao menos 8 caracteres, uma letra maiúscula e um caractere especial." });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    db.run(
      "INSERT INTO usuario (nome, cpf, email, senha_hash, telefone, cep_localizacao) VALUES (?, ?, ?, ?, ?, ?)",
      [nome, cpf, email, hashPassword(senha), telefone || null, normalizedCep],
      function insertUser(userError) {
        if (userError) return rollback(userError);
        const userId = this.lastID;
        settled = true;
        db.run("COMMIT", (commitError) => {
          if (commitError) return res.status(500).json({ message: "Não foi possível concluir o cadastro." });
          res.status(201).json({ id: userId, message: "Cadastro criado com sucesso." });
        });
      },
    );

    let settled = false;
    function rollback(error) {
      if (settled) return;
      settled = true;
      db.run("ROLLBACK", () => {
        const message = error.code?.includes("UNIQUE")
          ? "Já existe uma conta cadastrada com este CPF ou e-mail."
          : "Não foi possível criar seu cadastro.";
        res.status(400).json({ message });
      });
    }
  });
});

app.post("/api/instituicoes", blockRegistrationsInDemo, (req, res) => {
  const { nome, descricao, cnpj, email, telefone, senha, endereco, categorias = [] } = req.body;
  const { logradouro, numero, complemento, bairro, cidade, estado, cep } = endereco || {};

  if (!nome || !cnpj || !email || !logradouro || !cidade || !estado || !cep) {
    return res.status(400).json({ message: "Preencha os campos obrigatórios da instituição e do endereço." });
  }
  if (!isValidPassword(senha)) {
    return res.status(400).json({ message: "A senha deve ter ao menos 8 caracteres, uma letra maiúscula e um caractere especial." });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    db.run(
      "INSERT INTO endereco (logradouro, numero, complemento, bairro, cidade, estado, cep) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [logradouro, numero || null, complemento || null, bairro || null, cidade, estado, cep],
      function insertAddress(addressError) {
        if (addressError) return rollback(addressError);
        const enderecoId = this.lastID;

        db.run(
          "INSERT INTO instituicao (nome, descricao, cnpj, email, senha_hash, telefone, endereco_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [nome, descricao || null, cnpj, email, hashPassword(senha), telefone || null, enderecoId],
          function insertInstitution(institutionError) {
            if (institutionError) return rollback(institutionError);
            const instituicaoId = this.lastID;
            const uniqueCategories = [...new Set(categorias.filter(Boolean))];

            let remaining = uniqueCategories.length;
            if (!remaining) return commit(instituicaoId);

            uniqueCategories.forEach((categoria) => {
              db.run("INSERT OR IGNORE INTO categoria (nome) VALUES (?)", [categoria], (categoryError) => {
                if (categoryError) return rollback(categoryError);
                db.get("SELECT id FROM categoria WHERE nome = ?", [categoria], (lookupError, category) => {
                  if (lookupError) return rollback(lookupError);
                  db.run(
                    "INSERT INTO instituicao_categoria (instituicao_id, categoria_id) VALUES (?, ?)",
                    [instituicaoId, category.id],
                    (linkError) => {
                      if (linkError) return rollback(linkError);
                      remaining -= 1;
                      if (!remaining) commit(instituicaoId);
                    },
                  );
                });
              });
            });
          },
        );
      },
    );

    let settled = false;
    function rollback(error) {
      if (settled) return;
      settled = true;
      db.run("ROLLBACK", () => {
        const message = error.code?.includes("UNIQUE")
          ? "Já existe uma instituição cadastrada com este CNPJ ou e-mail."
          : "Não foi possível enviar o cadastro.";
        res.status(400).json({ message });
      });
    }

    function commit(instituicaoId) {
      if (settled) return;
      settled = true;
      db.run("COMMIT", (commitError) => {
        if (commitError) return res.status(500).json({ message: "Não foi possível concluir o cadastro." });
        res.status(201).json({ id: instituicaoId, message: "Cadastro enviado para validação." });
      });
    }
  });
});

app.get("/api/instituicoes", (_req, res) => {
  db.all(
    `SELECT instituicao.id, instituicao.nome, instituicao.descricao, instituicao.foto_perfil_url, instituicao.foto_capa_url,
      endereco.logradouro, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado,
      endereco.latitude, endereco.longitude,
      COALESCE(GROUP_CONCAT(DISTINCT categoria.nome), 'Sem categoria') AS categoria,
      (
        SELECT demanda.titulo
        FROM demanda
        WHERE demanda.instituicao_id = instituicao.id AND demanda.status = 'ativa'
        ORDER BY demanda.data_criacao DESC, demanda.id DESC
        LIMIT 1
      ) AS demanda_atual
      FROM instituicao
      LEFT JOIN endereco ON endereco.id = instituicao.endereco_id
      LEFT JOIN instituicao_categoria ON instituicao_categoria.instituicao_id = instituicao.id
      LEFT JOIN categoria ON categoria.id = instituicao_categoria.categoria_id
      GROUP BY instituicao.id
      ORDER BY instituicao.nome`,
    (error, institutions) => {
      if (error) return res.status(500).json({ message: "Não foi possível carregar as instituições." });
      return res.json(institutions);
    },
  );
});

app.get("/api/instituicoes/:id", (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT instituicao.id, instituicao.nome, instituicao.descricao,
      endereco.cidade, endereco.estado
      FROM instituicao LEFT JOIN endereco ON endereco.id = instituicao.endereco_id
      WHERE instituicao.id = ?`,
    [id],
    (error, instituicao) => {
      if (error) return res.status(500).json({ message: "Não foi possível carregar a instituição." });
      if (!instituicao) return res.status(404).json({ message: "Instituição não encontrada." });
      res.json(instituicao);
    },
  );
});

app.get("/api/minha-instituicao", requireAuthentication, (req, res) => {
  if (req.auth.perfil !== "instituicao") return res.status(403).json({ message: "Ação restrita a instituições." });
  db.get(
    `SELECT instituicao.id, instituicao.nome, instituicao.descricao, instituicao.cnpj,
      instituicao.email, instituicao.telefone, instituicao.foto_perfil_url, instituicao.foto_capa_url, endereco.logradouro, endereco.numero,
      endereco.complemento, endereco.bairro, endereco.cidade, endereco.estado, endereco.cep
      FROM instituicao LEFT JOIN endereco ON endereco.id = instituicao.endereco_id
      WHERE instituicao.id = ?`,
    [req.auth.id],
    (error, institution) => {
      if (error) return res.status(500).json({ message: "Não foi possível carregar o perfil." });
      if (!institution) return res.status(404).json({ message: "Instituição não encontrada." });
      return res.json(institution);
    },
  );
});

app.put("/api/instituicoes/:id", requireAuthentication, requireInstitutionOwner, (req, res) => {
  const { nome, descricao, telefone, email, fotoPerfilUrl, fotoCapaUrl } = req.body;
  if (!nome || !email) return res.status(400).json({ message: "Nome e e-mail são obrigatórios." });
  const descriptionWords = String(descricao || "").trim().split(/\s+/).filter(Boolean).length;
  if (descriptionWords >= 500) {
    return res.status(400).json({ message: "A descrição deve ter menos de 500 palavras." });
  }
  db.run(
    "UPDATE instituicao SET nome = ?, descricao = ?, telefone = ?, email = ?, foto_perfil_url = ?, foto_capa_url = ? WHERE id = ?",
    [nome, descricao || null, telefone || null, email, fotoPerfilUrl || null, fotoCapaUrl || null, req.params.id],
    function updateInstitution(error) {
      if (error) return res.status(400).json({ message: "Não foi possível atualizar o perfil." });
      if (!this.changes) return res.status(404).json({ message: "Instituição não encontrada." });
      res.json({ message: "Perfil atualizado." });
    },
  );
});

app.get("/api/instituicoes/:id/demandas", (req, res) => {
  db.all(
    "SELECT id, titulo, descricao, imagem_url, tipo, classificacao, quantidade_necessaria, data_criacao FROM demanda WHERE instituicao_id = ? AND status = 'ativa' ORDER BY data_criacao DESC",
    [req.params.id],
    (error, demandas) => {
      if (error) return res.status(500).json({ message: "Não foi possível carregar as demandas." });
      res.json(demandas);
    },
  );
});

app.post("/api/demandas/:id/interesses", requireAuthentication, requireUser, (req, res) => {
  db.get(
    "SELECT id FROM demanda WHERE id = ? AND status = 'ativa'",
    [req.params.id],
    (lookupError, demand) => {
      if (lookupError) return res.status(500).json({ message: "Não foi possível localizar a demanda." });
      if (!demand) return res.status(404).json({ message: "Esta demanda não está mais disponível." });
      db.get(
        "SELECT id FROM doacao WHERE usuario_id = ? AND demanda_id = ?",
        [req.auth.id, demand.id],
        (existingError, existingDonation) => {
          if (existingError) return res.status(500).json({ message: "Não foi possível registrar seu interesse." });
          if (existingDonation) return res.status(409).json({ message: "Seu interesse nesta demanda já foi registrado." });
          db.run(
            "INSERT INTO doacao (usuario_id, demanda_id, status) VALUES (?, ?, 'interesse')",
            [req.auth.id, demand.id],
            function registerInterest(insertError) {
              if (insertError) return res.status(500).json({ message: "Não foi possível registrar seu interesse." });
              return res.status(201).json({ id: this.lastID, message: "Interesse registrado. A instituição combinará a doação diretamente com você." });
            },
          );
        },
      );
    },
  );
});

app.get("/api/minha-instituicao/demandas", requireAuthentication, (req, res) => {
  if (req.auth.perfil !== "instituicao") return res.status(403).json({ message: "Ação restrita a instituições." });
  db.all(
    "SELECT id, titulo, descricao, imagem_url, tipo, classificacao, quantidade_necessaria, status, data_criacao FROM demanda WHERE instituicao_id = ? ORDER BY data_criacao DESC",
    [req.auth.id],
    (error, demands) => {
      if (error) return res.status(500).json({ message: "Não foi possível carregar as demandas." });
      return res.json(demands);
    },
  );
});

app.post("/api/instituicoes/:id/demandas", requireAuthentication, requireInstitutionOwner, (req, res) => {
  const { titulo, descricao, imagem_url, tipo = "item", classificacao = "pontual", quantidade_necessaria } = req.body;
  if (!titulo) return res.status(400).json({ message: "O título da demanda é obrigatório." });
  if (!['pontual', 'urgente', 'mensal'].includes(classificacao)) return res.status(400).json({ message: "Classificação de demanda inválida." });
  db.run(
    "INSERT INTO demanda (instituicao_id, titulo, descricao, imagem_url, tipo, classificacao, quantidade_necessaria) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [req.params.id, titulo, descricao || null, imagem_url || null, tipo, classificacao, quantidade_necessaria || null],
    function createDemand(error) {
      if (error) return res.status(400).json({ message: "Não foi possível criar a demanda." });
      res.status(201).json({ id: this.lastID, message: "Demanda criada." });
    },
  );
});

app.put("/api/demandas/:id", requireAuthentication, requireDemandOwner, (req, res) => {
  const { titulo, descricao, imagem_url, tipo, classificacao = "pontual", quantidade_necessaria, status } = req.body;
  if (!titulo || !tipo || !status) return res.status(400).json({ message: "Título, tipo e status são obrigatórios." });
  if (!['pontual', 'urgente', 'mensal'].includes(classificacao)) return res.status(400).json({ message: "Classificação de demanda inválida." });
  db.run(
    "UPDATE demanda SET titulo = ?, descricao = ?, imagem_url = ?, tipo = ?, classificacao = ?, quantidade_necessaria = ?, status = ? WHERE id = ?",
    [titulo, descricao || null, imagem_url || null, tipo, classificacao, quantidade_necessaria || null, status, req.params.id],
    function updateDemand(error) {
      if (error) return res.status(400).json({ message: "Não foi possível atualizar a demanda." });
      if (!this.changes) return res.status(404).json({ message: "Demanda não encontrada." });
      res.json({ message: "Demanda atualizada." });
    },
  );
});

app.delete("/api/demandas/:id", requireAuthentication, requireDemandOwner, (req, res) => {
  db.run("DELETE FROM demanda WHERE id = ?", [req.params.id], function deleteDemand(error) {
    if (error) return res.status(500).json({ message: "Não foi possível excluir a demanda." });
    if (!this.changes) return res.status(404).json({ message: "Demanda não encontrada." });
    res.status(204).end();
  });
});

if (isProduction) {
  const clientBuildDirectory = path.resolve(__dirname, "../client/dist");
  app.use(express.static(clientBuildDirectory));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => res.sendFile(path.join(clientBuildDirectory, "index.html")));
}

app.use((error, _req, res, _next) => {
  if (error?.message === "Origem não permitida.") {
    return res.status(403).json({ message: "Origem não permitida." });
  }
  return res.status(500).json({ message: "Erro inesperado." });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}${demoMode ? " (modo de demonstração)" : ""}`);
});
