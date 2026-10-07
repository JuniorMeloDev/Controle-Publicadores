-- Importação das imagens: Vida e Ministério, outubro/novembro de 2026.
-- Execute o arquivo inteiro no editor SQL do Neon.
-- Substitui o programa e as designações SOMENTE nas quatro datas abaixo.
-- Correspondências confirmadas: Daniela Silva (67) e Mariana Almeida (40).
-- Dados reais fornecidos para importação; este arquivo não é uma fixture de teste.
BEGIN;

CREATE TEMP TABLE importacao_vm_nomes (
    nome_imagem text PRIMARY KEY,
    publicador_id integer
) ON COMMIT DROP;

-- João Araújo não tem cadastro: a leitura fica no JSON do programa.
-- O NULL para esse estudante é intencional; não cria um publicador.
INSERT INTO importacao_vm_nomes (nome_imagem, publicador_id) VALUES
    ('Denisson Freire', 50),
    ('Tiago Medeiros', 7),
    ('Alisson Augusto', 103),
    ('Luiz Filipe', 93),
    ('Paulo Quintas', 36),
    ('Aristotelis Lima', 95),
    ('Kellycia Fortunato', 85),
    ('Laudicéa', 38),
    ('Ketlyn Fortunato', 92),
    ('Sandra Silva', 37),
    ('Jenelice Almeida', 90),
    ('Madalena Fabricio', 8),
    ('Sandra Lopes', 107),
    ('Juliana Duarte', 53),
    ('Junior Melo', 1),
    ('Ives Duda', 86),
    ('Ubirajara Macena', 63),
    ('Gilliano Menezes', 105),
    ('Danilo Medeiros', 13),
    ('Otávio Malucelli', 78),
    ('Heitor Cabral', 28),
    ('Carol Malucelli', 81),
    ('Daniela Domingos', 67),
    ('Flavia Maria', 56),
    ('Isabela Quintas', 48),
    ('Marcio Monteiro', 2),
    ('Paulo César', 33),
    ('César Araújo', 39),
    ('Bruno Barbosa', 82),
    ('Edmilson Cabral', 22),
    ('João Araújo', NULL),
    ('Angelica Cabral', 31),
    ('Carol Barbosa', 80),
    ('Géssika Menezes', 70),
    ('Isis Monteiro', 23),
    ('Eduarda Malucelli', 79),
    ('Steves Scanoni', 102),
    ('Deivisson Freire', 74),
    ('João Malucelli', 71),
    ('Danilo Paixão', 97),
    ('Fernando Araújo', 45),
    ('Célia Rolim', 16),
    ('Tekinha Araújo', 34),
    ('Arlete Medeiros', 15),
    ('Rosinete Galdino', 3),
    ('Mariana Araújo', 40),
    ('Moacyr Medeiros', 11);

CREATE TEMP TABLE importacao_vm_programas (
    data date PRIMARY KEY,
    programa jsonb NOT NULL,
    designacoes jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO importacao_vm_programas (data, programa, designacoes) VALUES
    (DATE '2026-10-07',
     $programa${
  "weekDate": "05 - 11 de Outubro de 2026",
  "bibleReading": "JEREMIAS 40-41",
  "initialSong": "Cântico 33",
  "openingComments": "Comentários iniciais (1 min)",
  "treasures": [
    {
      "title": "1. Tenha o ponto de vista correto sobre a proteção de Jeová (10 min)"
    },
    {
      "title": "2. Joias espirituais: (10 min)"
    },
    {
      "title": "3. Leitura da Bíblia: Jer 40:1-10 (4 min)"
    }
  ],
  "ministry": [
    {
      "title": "4. Iniciando conversas: (2 min) DE CASA EM CASA. (lmd lição 2 ponto 3)"
    },
    {
      "title": "5. Iniciando conversas: (2 min) TESTEMUNHO INFORMAL. (lmd lição 2 ponto 5)"
    },
    {
      "title": "6. Iniciando conversas: (4 min) TESTEMUNHO PÚBLICO. Uma pessoa está olhando o carrinho de publicações. (lmd lição 5 ponto 3)"
    },
    {
      "title": "7. Explicando suas crenças: (3 min) Demonstração. Tema: Quem é Jeová e por que seu nome é importante? (th lição 17)"
    }
  ],
  "middleSong": "Cântico 17",
  "living": [
    {
      "title": "8. Jeová é o Protetor das viúvas (15 min) Consideração."
    },
    {
      "title": "9. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)"
    }
  ],
  "finalSong": "Cântico 38",
  "finalComments": "Comentários finais (3 min)"
}$programa$::jsonb,
     $designacoes$[
  {
    "ordem": 1,
    "nome_parte": "Presidente",
    "nome_imagem": "Denisson Freire"
  },
  {
    "ordem": 2,
    "nome_parte": "Ajudante",
    "nome_imagem": "Tiago Medeiros"
  },
  {
    "ordem": 3,
    "nome_parte": "Oração Inicial",
    "nome_imagem": "Alisson Augusto"
  },
  {
    "ordem": 4,
    "nome_parte": "Comentários iniciais (1 min)",
    "nome_imagem": "Denisson Freire"
  },
  {
    "ordem": 5,
    "nome_parte": "1. Tenha o ponto de vista correto sobre a proteção de Jeová (10 min)",
    "nome_imagem": "Luiz Filipe"
  },
  {
    "ordem": 6,
    "nome_parte": "2. Joias espirituais: (10 min)",
    "nome_imagem": "Paulo Quintas"
  },
  {
    "ordem": 7,
    "nome_parte": "3. Leitura da Bíblia: Jer 40:1-10 (4 min)",
    "nome_imagem": "Aristotelis Lima"
  },
  {
    "ordem": 8,
    "nome_parte": "4. Iniciando conversas: (2 min)",
    "nome_imagem": "Kellycia Fortunato"
  },
  {
    "ordem": 9,
    "nome_parte": "4. Iniciando conversas: (2 min)",
    "nome_imagem": "Laudicéa"
  },
  {
    "ordem": 10,
    "nome_parte": "5. Iniciando conversas: (2 min)",
    "nome_imagem": "Ketlyn Fortunato"
  },
  {
    "ordem": 11,
    "nome_parte": "5. Iniciando conversas: (2 min)",
    "nome_imagem": "Sandra Silva"
  },
  {
    "ordem": 12,
    "nome_parte": "6. Iniciando conversas: (4 min)",
    "nome_imagem": "Jenelice Almeida"
  },
  {
    "ordem": 13,
    "nome_parte": "6. Iniciando conversas: (4 min)",
    "nome_imagem": "Madalena Fabricio"
  },
  {
    "ordem": 14,
    "nome_parte": "7. Explicando suas crenças: (3 min)",
    "nome_imagem": "Sandra Lopes"
  },
  {
    "ordem": 15,
    "nome_parte": "7. Explicando suas crenças: (3 min)",
    "nome_imagem": "Juliana Duarte"
  },
  {
    "ordem": 16,
    "nome_parte": "Cântico 17",
    "nome_imagem": "Denisson Freire"
  },
  {
    "ordem": 17,
    "nome_parte": "8. Jeová é o Protetor das viúvas (15 min): Consideração",
    "nome_imagem": "Junior Melo"
  },
  {
    "ordem": 18,
    "nome_parte": "9. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)",
    "nome_imagem": "Ives Duda"
  },
  {
    "ordem": 19,
    "nome_parte": "9. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)",
    "nome_imagem": "Tiago Medeiros"
  },
  {
    "ordem": 20,
    "nome_parte": "Comentários finais (3 min)",
    "nome_imagem": "Denisson Freire"
  },
  {
    "ordem": 21,
    "nome_parte": "Oração Final",
    "nome_imagem": "Ubirajara Macena"
  }
]$designacoes$::jsonb),
    (DATE '2026-10-14',
     $programa${
  "weekDate": "12 - 18 de Outubro de 2026",
  "bibleReading": "JEREMIAS 42-44",
  "initialSong": "Cântico 103",
  "openingComments": "Comentários iniciais (1 min)",
  "treasures": [
    {
      "title": "1. Eles perguntaram o que fazer, mas não obedeceram (10 min)"
    },
    {
      "title": "2. Joias espirituais: (10 min)"
    },
    {
      "title": "3. Leitura da Bíblia: Jer 43:1-13 (4 min)"
    }
  ],
  "ministry": [
    {
      "title": "4. Iniciando conversas: (3 min) TESTEMUNHO INFORMAL. (lmd lição 1 ponto 5)"
    },
    {
      "title": "5. Cultivando o interesse: (4 min) DE CASA EM CASA. Fale sobre uma das verdades do apêndice A da brochura Ame as Pessoas. (lmd lição 7 ponto 4)"
    },
    {
      "title": "6. O que você diria? (6 min) Consideração. TESTEMUNHO INFORMAL. Faça um resumo da lmd lição 2 ponto 3."
    }
  ],
  "middleSong": "Cântico 47",
  "living": [
    {
      "title": "7. Necessidades locais (15 min)"
    },
    {
      "title": "8. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)"
    }
  ],
  "finalSong": "Cântico 129",
  "finalComments": "Comentários finais (3 min ou menos)"
}$programa$::jsonb,
     $designacoes$[
  {
    "ordem": 1,
    "nome_parte": "Presidente",
    "nome_imagem": "Gilliano Menezes"
  },
  {
    "ordem": 2,
    "nome_parte": "Ajudante",
    "nome_imagem": "Danilo Medeiros"
  },
  {
    "ordem": 3,
    "nome_parte": "Oração Inicial",
    "nome_imagem": "Otávio Malucelli"
  },
  {
    "ordem": 4,
    "nome_parte": "Comentários iniciais (1 min)",
    "nome_imagem": "Gilliano Menezes"
  },
  {
    "ordem": 5,
    "nome_parte": "1. Eles perguntaram o que fazer, mas não obedeceram (10 min)",
    "nome_imagem": "Ives Duda"
  },
  {
    "ordem": 6,
    "nome_parte": "2. Joias espirituais: (10 min)",
    "nome_imagem": "Tiago Medeiros"
  },
  {
    "ordem": 7,
    "nome_parte": "3. Leitura da Bíblia: Jer 43:1-13 (4 min)",
    "nome_imagem": "Heitor Cabral"
  },
  {
    "ordem": 8,
    "nome_parte": "4. Iniciando conversas: (3 min)",
    "nome_imagem": "Carol Malucelli"
  },
  {
    "ordem": 9,
    "nome_parte": "4. Iniciando conversas: (3 min)",
    "nome_imagem": "Daniela Domingos"
  },
  {
    "ordem": 10,
    "nome_parte": "5. Cultivando o interesse: (4 min)",
    "nome_imagem": "Flavia Maria"
  },
  {
    "ordem": 11,
    "nome_parte": "5. Cultivando o interesse: (4 min)",
    "nome_imagem": "Isabela Quintas"
  },
  {
    "ordem": 12,
    "nome_parte": "6. O que você diria? (6 min): Consideração",
    "nome_imagem": "Denisson Freire"
  },
  {
    "ordem": 13,
    "nome_parte": "Cântico 47",
    "nome_imagem": "Gilliano Menezes"
  },
  {
    "ordem": 14,
    "nome_parte": "7. Necessidades locais (15 min)",
    "nome_imagem": "Marcio Monteiro"
  },
  {
    "ordem": 15,
    "nome_parte": "8. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)",
    "nome_imagem": "Junior Melo"
  },
  {
    "ordem": 16,
    "nome_parte": "8. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)",
    "nome_imagem": "Alisson Augusto"
  },
  {
    "ordem": 17,
    "nome_parte": "Comentários finais (3 min ou menos)",
    "nome_imagem": "Gilliano Menezes"
  },
  {
    "ordem": 18,
    "nome_parte": "Oração Final",
    "nome_imagem": "Luiz Filipe"
  }
]$designacoes$::jsonb),
    (DATE '2026-10-21',
     $programa${
  "weekDate": "19 - 25 de Outubro de 2026",
  "bibleReading": "JEREMIAS 45-46",
  "initialSong": "Cântico 21",
  "openingComments": "Comentários iniciais (1 min)",
  "treasures": [
    {
      "title": "1. Ter esperança é o segredo para o contentamento (10 min)"
    },
    {
      "title": "2. Joias espirituais: (10 min)"
    },
    {
      "title": "3. Leitura da Bíblia: Jer 46:13-24 (4 min)"
    }
  ],
  "ministry": [
    {
      "title": "4. Iniciando conversas: (3 min) DE CASA EM CASA. Fale sobre uma das verdades do apêndice A da brochura Ame as Pessoas. (lmd lição 2 ponto 3)"
    },
    {
      "title": "5. Iniciando conversas: (2 min) DE CASA EM CASA. A pessoa está irritada. (lmd lição 4 ponto 5)"
    },
    {
      "title": "6. Iniciando conversas: (2 min) DE CASA EM CASA. Uma pessoa que parece estar triste vem atender. (lmd lição 2 ponto 4)"
    },
    {
      "title": "7. Discurso: (4 min) Tema: Jesus não é o Deus Todo-Poderoso. (th lição 7)"
    }
  ],
  "middleSong": "Cântico 117",
  "living": [
    {
      "title": "8. “Partilhe com outros o que você tem” (15 min)"
    },
    {
      "title": "9. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)"
    }
  ],
  "finalSong": "Cântico 87",
  "finalComments": "Comentários finais (3 min)",
  "participantes_externos": [
    {
      "parte_id": "tesouro_2",
      "nome_parte": "3. Leitura da Bíblia: Jer 46:13-24 (4 min)",
      "nome_completo": "João Araújo"
    }
  ]
}$programa$::jsonb,
     $designacoes$[
  {
    "ordem": 1,
    "nome_parte": "Presidente",
    "nome_imagem": "Paulo César"
  },
  {
    "ordem": 2,
    "nome_parte": "Ajudante",
    "nome_imagem": "Alisson Augusto"
  },
  {
    "ordem": 3,
    "nome_parte": "Oração Inicial",
    "nome_imagem": "César Araújo"
  },
  {
    "ordem": 4,
    "nome_parte": "Comentários iniciais (1 min)",
    "nome_imagem": "Paulo César"
  },
  {
    "ordem": 5,
    "nome_parte": "1. Ter esperança é o segredo para o contentamento (10 min)",
    "nome_imagem": "Bruno Barbosa"
  },
  {
    "ordem": 6,
    "nome_parte": "2. Joias espirituais: (10 min)",
    "nome_imagem": "Edmilson Cabral"
  },
  {
    "ordem": 7,
    "nome_parte": "3. Leitura da Bíblia: Jer 46:13-24 (4 min)",
    "nome_imagem": "João Araújo"
  },
  {
    "ordem": 8,
    "nome_parte": "4. Iniciando conversas: (3 min)",
    "nome_imagem": "Angelica Cabral"
  },
  {
    "ordem": 9,
    "nome_parte": "4. Iniciando conversas: (3 min)",
    "nome_imagem": "Carol Barbosa"
  },
  {
    "ordem": 10,
    "nome_parte": "5. Iniciando conversas: (2 min)",
    "nome_imagem": "Géssika Menezes"
  },
  {
    "ordem": 11,
    "nome_parte": "5. Iniciando conversas: (2 min)",
    "nome_imagem": "Isis Monteiro"
  },
  {
    "ordem": 12,
    "nome_parte": "6. Iniciando conversas: (2 min)",
    "nome_imagem": "Eduarda Malucelli"
  },
  {
    "ordem": 13,
    "nome_parte": "6. Iniciando conversas: (2 min)",
    "nome_imagem": "Ketlyn Fortunato"
  },
  {
    "ordem": 14,
    "nome_parte": "7. Discurso: (4 min)",
    "nome_imagem": "Steves Scanoni"
  },
  {
    "ordem": 15,
    "nome_parte": "Cântico 117",
    "nome_imagem": "Paulo César"
  },
  {
    "ordem": 16,
    "nome_parte": "8. “Partilhe com outros o que você tem” (15 min)",
    "nome_imagem": "Junior Melo"
  },
  {
    "ordem": 17,
    "nome_parte": "9. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)",
    "nome_imagem": "Deivisson Freire"
  },
  {
    "ordem": 18,
    "nome_parte": "9. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)",
    "nome_imagem": "Paulo Quintas"
  },
  {
    "ordem": 19,
    "nome_parte": "Comentários finais (3 min)",
    "nome_imagem": "Paulo César"
  },
  {
    "ordem": 20,
    "nome_parte": "Oração Final",
    "nome_imagem": "Bruno Barbosa"
  }
]$designacoes$::jsonb),
    (DATE '2026-11-04',
     $programa${
  "weekDate": "02 - 08 de Novembro de 2026",
  "bibleReading": "JEREMIAS 49-50",
  "initialSong": "Cântico 1",
  "openingComments": "Comentários iniciais (1 min)",
  "treasures": [
    {
      "title": "1. Ajude outros a se beneficiar da misericórdia de Jeová (10 min)"
    },
    {
      "title": "2. Joias espirituais: (10 min)"
    },
    {
      "title": "3. Leitura da Bíblia: Jer 50:24-40 (4 min)"
    }
  ],
  "ministry": [
    {
      "title": "4. Iniciando conversas: (3 min) DE CASA EM CASA. Fale sobre uma verdade da Bíblia. Talvez você possa usar uma das que estão no apêndice A da brochura Ame as Pessoas. (lmd lição 1 ponto 5)"
    },
    {
      "title": "5. Cultivando o interesse: (4 min) DE CASA EM CASA. Você se preparou para falar de um assunto, mas a pessoa quer falar sobre um assunto diferente. (lmd lição 3 ponto 3)"
    },
    {
      "title": "6. Fazendo discípulos: (5 min) lff lição 20 ponto 4 (lmd lição 11 ponto 4)"
    }
  ],
  "middleSong": "Cântico 67",
  "living": [
    {
      "title": "7. Nunca se Esqueça do Que Jeová se Lembra (15 min) Consideração."
    },
    {
      "title": "8. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)"
    }
  ],
  "finalSong": "Cântico 33",
  "finalComments": "Comentários finais (3 min)"
}$programa$::jsonb,
     $designacoes$[
  {
    "ordem": 1,
    "nome_parte": "Presidente",
    "nome_imagem": "Marcio Monteiro"
  },
  {
    "ordem": 2,
    "nome_parte": "Ajudante",
    "nome_imagem": "João Malucelli"
  },
  {
    "ordem": 3,
    "nome_parte": "Oração Inicial",
    "nome_imagem": "Paulo César"
  },
  {
    "ordem": 4,
    "nome_parte": "Comentários iniciais (1 min)",
    "nome_imagem": "Marcio Monteiro"
  },
  {
    "ordem": 5,
    "nome_parte": "1. Ajude outros a se beneficiar da misericórdia de Jeová (10 min)",
    "nome_imagem": "Tiago Medeiros"
  },
  {
    "ordem": 6,
    "nome_parte": "2. Joias espirituais: (10 min)",
    "nome_imagem": "Danilo Paixão"
  },
  {
    "ordem": 7,
    "nome_parte": "3. Leitura da Bíblia: Jer 50:24-40 (4 min)",
    "nome_imagem": "Fernando Araújo"
  },
  {
    "ordem": 8,
    "nome_parte": "4. Iniciando conversas: (3 min)",
    "nome_imagem": "Célia Rolim"
  },
  {
    "ordem": 9,
    "nome_parte": "4. Iniciando conversas: (3 min)",
    "nome_imagem": "Tekinha Araújo"
  },
  {
    "ordem": 10,
    "nome_parte": "5. Cultivando o interesse: (4 min)",
    "nome_imagem": "Arlete Medeiros"
  },
  {
    "ordem": 11,
    "nome_parte": "5. Cultivando o interesse: (4 min)",
    "nome_imagem": "Flavia Maria"
  },
  {
    "ordem": 12,
    "nome_parte": "6. Fazendo discípulos: (5 min)",
    "nome_imagem": "Rosinete Galdino"
  },
  {
    "ordem": 13,
    "nome_parte": "6. Fazendo discípulos: (5 min)",
    "nome_imagem": "Mariana Araújo"
  },
  {
    "ordem": 14,
    "nome_parte": "Cântico 67",
    "nome_imagem": "Marcio Monteiro"
  },
  {
    "ordem": 15,
    "nome_parte": "7. Nunca se Esqueça do Que Jeová se Lembra (15 min): Consideração",
    "nome_imagem": "Gilliano Menezes"
  },
  {
    "ordem": 16,
    "nome_parte": "8. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)",
    "nome_imagem": "Bruno Barbosa"
  },
  {
    "ordem": 17,
    "nome_parte": "8. Estudo bíblico de congregação: Ande Corajosamente com Deus (30 min)",
    "nome_imagem": "Moacyr Medeiros"
  },
  {
    "ordem": 18,
    "nome_parte": "Comentários finais (3 min)",
    "nome_imagem": "Marcio Monteiro"
  },
  {
    "ordem": 19,
    "nome_parte": "Oração Final",
    "nome_imagem": "Junior Melo"
  }
]$designacoes$::jsonb);

-- Validação antes de modificar as tabelas do aplicativo.
DO $validacao$
DECLARE
    pendentes text;
BEGIN
    SELECT string_agg(DISTINCT d.nome_imagem, ', ' ORDER BY d.nome_imagem)
    INTO pendentes
    FROM importacao_vm_programas i
    CROSS JOIN LATERAL jsonb_to_recordset(i.designacoes)
        AS d(ordem integer, nome_parte text, nome_imagem text)
    LEFT JOIN importacao_vm_nomes n ON n.nome_imagem = d.nome_imagem
    LEFT JOIN publicadores p ON p.id = n.publicador_id
    WHERE p.id IS NULL AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(i.programa->'participantes_externos', '[]'::jsonb)) externo
        WHERE externo->>'nome_completo' = d.nome_imagem AND externo->>'nome_parte' = d.nome_parte
    );

    IF pendentes IS NOT NULL THEN
        RAISE EXCEPTION 'Confirme os IDs dos publicadores antes de importar: %', pendentes;
    END IF;
END;
$validacao$;

-- Salva a estrutura que a aba Vida e Ministério usa para abrir o modal.
INSERT INTO reunioes_dados (data_reuniao, dados_json, descricao_texto)
SELECT data, programa, programa->>'weekDate'
FROM importacao_vm_programas
ON CONFLICT (data_reuniao) DO UPDATE SET
    dados_json = EXCLUDED.dados_json,
    descricao_texto = EXCLUDED.descricao_texto;

-- Permite executar novamente sem duplicar as partes.
DELETE FROM designacoes_reuniao
WHERE data_reuniao IN (SELECT data FROM importacao_vm_programas);

-- A ordem é importante: estudante antes do ajudante; dirigente antes do leitor.
INSERT INTO designacoes_reuniao (
    publicador_id, data_reuniao, descricao_semana, nome_parte
)
SELECT n.publicador_id, i.data, i.programa->>'weekDate', d.nome_parte
FROM importacao_vm_programas i
CROSS JOIN LATERAL jsonb_to_recordset(i.designacoes)
    AS d(ordem integer, nome_parte text, nome_imagem text)
JOIN importacao_vm_nomes n ON n.nome_imagem = d.nome_imagem
WHERE n.publicador_id IS NOT NULL
ORDER BY i.data, d.ordem;

SELECT i.data AS data_reuniao,
    (SELECT COUNT(*) FROM designacoes_reuniao d WHERE d.data_reuniao = i.data) AS designacoes_cadastradas,
    jsonb_array_length(COALESCE(i.programa->'participantes_externos', '[]'::jsonb)) AS estudantes_sem_cadastro
FROM importacao_vm_programas i
ORDER BY i.data;

COMMIT;
