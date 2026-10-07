const crypto = require('crypto');
const db = require('./database');

// As organizações abaixo são fictícias. Os endereços existem e servem somente
// como pontos de referência para a demonstração do mapa em Montes Claros/MG.
const demoInstitutions = [
  {
    nome: 'Casa Aurora — demonstração',
    descricao: 'Organização fictícia de apoio a crianças e adolescentes, criada para demonstrar a plataforma.',
    cnpj: 'DEMO-MOC-0001',
    email: 'casa.aurora@exemplo.test',
    telefone: '(38) 90000-0001',
    categoria: 'Assistência social',
    endereco: { logradouro: 'Avenida Cula Mangabeira', numero: '211', complemento: 'Ponto de referência', bairro: 'Centro', cidade: 'Montes Claros', estado: 'MG', cep: '39401-002', latitude: -16.7286, longitude: -43.8580 },
    demanda: { titulo: 'Kits de higiene', descricao: 'Sabonetes, absorventes, creme dental e fraldas para famílias acompanhadas.', tipo: 'Itens', quantidade: 80 },
  },
  {
    nome: 'Instituto Sementes do Norte — demonstração',
    descricao: 'Organização fictícia voltada a atividades de educação e cultura para jovens.',
    cnpj: 'DEMO-MOC-0002',
    email: 'sementes.norte@exemplo.test',
    telefone: '(38) 90000-0002',
    categoria: 'Educação e cultura',
    endereco: { logradouro: 'Avenida Professor Rui Braga', numero: 's/n', complemento: 'Ponto de referência', bairro: 'Vila Mauricéia', cidade: 'Montes Claros', estado: 'MG', cep: '39401-089', latitude: -16.7009, longitude: -43.8784 },
    demanda: { titulo: 'Material escolar', descricao: 'Cadernos, lápis, mochilas e livros para oficinas educativas.', tipo: 'Itens', quantidade: 120 },
  },
  {
    nome: 'Projeto Vira-Lata MOC — demonstração',
    descricao: 'Organização fictícia de proteção animal, incluída apenas para a apresentação do protótipo.',
    cnpj: 'DEMO-MOC-0003',
    email: 'viralata.moc@exemplo.test',
    telefone: '(38) 90000-0003',
    categoria: 'Causa animal',
    endereco: { logradouro: 'Rua Marechal Deodoro', numero: '1460', complemento: 'Ponto de referência', bairro: 'Centro', cidade: 'Montes Claros', estado: 'MG', cep: '39400-908', latitude: -16.7274, longitude: -43.8554 },
    demanda: { titulo: 'Ração e medicamentos', descricao: 'Ração para cães e gatos e itens básicos de cuidado veterinário.', tipo: 'Itens', quantidade: 150 },
  },
  {
    nome: 'Coletivo Verde Norte — demonstração',
    descricao: 'Organização fictícia de educação ambiental e recuperação de espaços comunitários.',
    cnpj: 'DEMO-MOC-0004',
    email: 'verde.norte@exemplo.test',
    telefone: '(38) 90000-0004',
    categoria: 'Meio ambiente',
    endereco: { logradouro: 'Avenida Pedro Augusto Veloso', numero: '884', complemento: 'Ponto de referência', bairro: 'Morada do Sol', cidade: 'Montes Claros', estado: 'MG', cep: '39401-367', latitude: -16.7533, longitude: -43.8836 },
    demanda: { titulo: 'Mudas e ferramentas', descricao: 'Mudas nativas, luvas e ferramentas leves para mutirões comunitários.', tipo: 'Itens', quantidade: 60 },
  },
  {
    nome: 'Ponto de Partida — demonstração',
    descricao: 'Organização fictícia que promove acolhimento e orientação para jovens em transição para o trabalho.',
    cnpj: 'DEMO-MOC-0005',
    email: 'ponto.partida@exemplo.test',
    telefone: '(38) 90000-0005',
    categoria: 'Saúde e bem-estar',
    endereco: { logradouro: 'Praça da Tecnologia', numero: '77', complemento: 'Ponto de referência', bairro: 'Alto São João', cidade: 'Montes Claros', estado: 'MG', cep: '39400-307', latitude: -16.7170, longitude: -43.8640 },
    demanda: { titulo: 'Vale-transporte solidário', descricao: 'Apoio de transporte para jovens que participam de processos seletivos e cursos.', tipo: 'Dinheiro', quantidade: 40 },
  },
  {
    nome: 'Rede Mesa Cheia — demonstração',
    descricao: 'Organização fictícia de combate à insegurança alimentar em comunidades locais.',
    cnpj: 'DEMO-MOC-0006',
    email: 'mesa.cheia@exemplo.test',
    telefone: '(38) 90000-0006',
    categoria: 'Assistência social',
    endereco: { logradouro: 'Rua Carlos Paulino Cardoso', numero: '401', complemento: 'Ponto de referência', bairro: 'Vila Exposição', cidade: 'Montes Claros', estado: 'MG', cep: '39400-218', latitude: -16.7227, longitude: -43.8664 },
    demanda: { titulo: 'Cestas básicas', descricao: 'Arroz, feijão, óleo, leite e outros alimentos não perecíveis.', tipo: 'Itens', quantidade: 100 },
  },
  {
    nome: 'Movimento Caminhos Livres — demonstração',
    descricao: 'Organização fictícia que desenvolve atividades de cidadania e inclusão em bairros periféricos.',
    cnpj: 'DEMO-MOC-0007',
    email: 'caminhos.livres@exemplo.test',
    telefone: '(38) 90000-0007',
    categoria: 'Assistência social',
    endereco: { logradouro: 'Praça Presidente Tancredo Neves', numero: 's/n', complemento: 'Ponto de referência', bairro: 'Canelas', cidade: 'Montes Claros', estado: 'MG', cep: '39402-595', latitude: -16.7390, longitude: -43.8755 },
    demanda: { titulo: 'Documentação cidadã', descricao: 'Apoio para emissão de documentos e participação em oficinas de cidadania.', tipo: 'Dinheiro', quantidade: 30 },
  },
  {
    nome: 'Ateliê Viver Arte — demonstração',
    descricao: 'Organização fictícia que oferece oficinas culturais e artísticas para crianças e adolescentes.',
    cnpj: 'DEMO-MOC-0008',
    email: 'viver.arte@exemplo.test',
    telefone: '(38) 90000-0008',
    categoria: 'Educação e cultura',
    endereco: { logradouro: 'Praça Doutor Chaves', numero: '32', complemento: 'Ponto de referência', bairro: 'Centro', cidade: 'Montes Claros', estado: 'MG', cep: '39400-005', latitude: -16.7264, longitude: -43.8598 },
    demanda: { titulo: 'Materiais para oficinas', descricao: 'Tintas, pincéis, papéis, tecidos e instrumentos de iniciação musical.', tipo: 'Itens', quantidade: 90 },
  },
  {
    nome: 'Núcleo Cuidado em Rede — demonstração',
    descricao: 'Organização fictícia que organiza redes de apoio para pessoas em situação de vulnerabilidade.',
    cnpj: 'DEMO-MOC-0009',
    email: 'cuidado.rede@exemplo.test',
    telefone: '(38) 90000-0009',
    categoria: 'Saúde e bem-estar',
    endereco: { logradouro: 'Avenida Doutor João Luiz de Almeida', numero: '719', complemento: 'Ponto de referência', bairro: 'Centro', cidade: 'Montes Claros', estado: 'MG', cep: '39400-613', latitude: -16.7310, longitude: -43.8506 },
    demanda: { titulo: 'Itens de cuidado', descricao: 'Fraldas geriátricas, produtos de higiene e materiais de primeiros socorros.', tipo: 'Itens', quantidade: 70 },
  },
  {
    nome: 'Banco de Tempo MOC — demonstração',
    descricao: 'Organização fictícia que conecta voluntários a iniciativas comunitárias.',
    cnpj: 'DEMO-MOC-0010',
    email: 'banco.tempo@exemplo.test',
    telefone: '(38) 90000-0010',
    categoria: 'Assistência social',
    endereco: { logradouro: 'Praça Raul Soares', numero: 's/n', complemento: 'Ponto de referência', bairro: 'Centro', cidade: 'Montes Claros', estado: 'MG', cep: '39401-002', latitude: -16.7279, longitude: -43.8615 },
    demanda: { titulo: 'Voluntários para mutirões', descricao: 'Pessoas disponíveis para apoiar atividades comunitárias nos fins de semana.', tipo: 'Serviços', quantidade: 25 },
  },
  {
    nome: 'Instituto Travessia — demonstração',
    descricao: 'Organização fictícia voltada à reinserção social e ao fortalecimento de vínculos familiares.',
    cnpj: 'DEMO-MOC-0011',
    email: 'instituto.travessia@exemplo.test',
    telefone: '(38) 90000-0011',
    categoria: 'Assistência social',
    endereco: { logradouro: 'Rua Tiradentes', numero: '422', complemento: 'Ponto de referência', bairro: 'Centro', cidade: 'Montes Claros', estado: 'MG', cep: '39400-076', latitude: -16.7271, longitude: -43.8569 },
    demanda: { titulo: 'Roupas e calçados', descricao: 'Peças novas ou em bom estado para pessoas em processo de reinserção.', tipo: 'Itens', quantidade: 110 },
  },
  {
    nome: 'Raízes do Cerrado — demonstração',
    descricao: 'Organização fictícia dedicada à educação ambiental e ao cuidado de áreas verdes urbanas.',
    cnpj: 'DEMO-MOC-0012',
    email: 'raizes.cerrado@exemplo.test',
    telefone: '(38) 90000-0012',
    categoria: 'Meio ambiente',
    endereco: { logradouro: 'Avenida Governador Magalhães Pinto', numero: '4000', complemento: 'Ponto de referência', bairro: 'Jaraguá', cidade: 'Montes Claros', estado: 'MG', cep: '39404-166', latitude: -16.7062, longitude: -43.8428 },
    demanda: { titulo: 'Coleta seletiva comunitária', descricao: 'Sacos resistentes, luvas e recipientes para pontos de coleta.', tipo: 'Itens', quantidade: 75 },
  },
];

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      return resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function seed() {
  try {
    await run('BEGIN');

    for (const category of ['Assistência social', 'Causa animal', 'Educação e cultura', 'Meio ambiente', 'Saúde e bem-estar']) {
      await run('INSERT OR IGNORE INTO categoria (nome) VALUES (?)', [category]);
    }

    for (const institution of demoInstitutions) {
      const category = await get('SELECT id FROM categoria WHERE nome = ?', [institution.categoria]);
      const existing = await get('SELECT id, endereco_id FROM instituicao WHERE cnpj = ?', [institution.cnpj]);
      let institutionId = existing?.id;

      if (existing) {
        await run(
          'UPDATE instituicao SET nome = ?, descricao = ?, email = ?, telefone = ? WHERE id = ?',
          [institution.nome, institution.descricao, institution.email, institution.telefone, institutionId],
        );
        await run(
          'UPDATE endereco SET logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, latitude = ?, longitude = ? WHERE id = ?',
          [...Object.values(institution.endereco), existing.endereco_id],
        );
      } else {
        const address = await run(
          'INSERT INTO endereco (logradouro, numero, complemento, bairro, cidade, estado, cep, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          Object.values(institution.endereco),
        );
        const created = await run(
          'INSERT INTO instituicao (nome, descricao, cnpj, email, senha_hash, telefone, endereco_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [institution.nome, institution.descricao, institution.cnpj, institution.email, hashPassword('Demo@2026'), institution.telefone, address.id],
        );
        institutionId = created.id;
      }

      await run('INSERT OR IGNORE INTO instituicao_categoria (instituicao_id, categoria_id) VALUES (?, ?)', [institutionId, category.id]);
      const demand = await get('SELECT id FROM demanda WHERE instituicao_id = ? AND titulo = ?', [institutionId, institution.demanda.titulo]);
      if (!demand) {
        await run(
          'INSERT INTO demanda (instituicao_id, titulo, descricao, tipo, quantidade_necessaria) VALUES (?, ?, ?, ?, ?)',
          [institutionId, institution.demanda.titulo, institution.demanda.descricao, institution.demanda.tipo, institution.demanda.quantidade],
        );
      }
    }

    await run('COMMIT');
    console.log(`${demoInstitutions.length} instituições fictícias de demonstração foram inseridas/atualizadas.`);
  } catch (error) {
    await run('ROLLBACK').catch(() => {});
    console.error('Não foi possível popular os dados de demonstração:', error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

seed();
