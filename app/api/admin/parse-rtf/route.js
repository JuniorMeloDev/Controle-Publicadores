import { NextResponse } from 'next/server';

// Esta é a função que chama a API do Gemini.
// Agora ela roda no servidor, onde a autenticação funciona.
async function callGeminiToParse(text) {
  // A chave da API é deixada em branco, pois será injetada
  // automaticamente pelo ambiente de produção (Vercel/Google).
  const apiKey = ""; 
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const systemPrompt = `
    Você é um assistente que extrai programações de reunião de arquivos de texto (RTF) da Apostila da Reunião "Nossa Vida e Ministério Cristão".
    Sua tarefa é ler o texto e retornar um objeto JSON estruturado com base no schema fornecido.
    Extraia apenas os títulos das partes e os tempos, conforme aparecem.
  `;

  const userQuery = `
    Por favor, extraia as informações da reunião deste texto e formate como JSON:
    ---
    ${text}
    ---
  `;

  // O Schema JSON que força a resposta estruturada
  const schema = {
    type: 'OBJECT',
    properties: {
      weekDate: { type: 'STRING', description: 'O período da semana, ex: "10-16 DE NOVEMBRO"' },
      bibleReading: { type: 'STRING', description: 'A leitura da Bíblia da semana, ex: "CÂNTICO DE SALOMÃO 3-5"' },
      initialSong: { type: 'STRING', description: 'O cântico inicial, ex: "Cântico 31"' },
      openingComments: { type: 'STRING', description: 'Os comentários iniciais, ex: "Comentários iniciais (1 min)"' },
      treasures: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Título completo da parte, ex: "A importância da beleza interior (10 min)"' }
          }
        }
      },
      ministry: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Título completo da parte, ex: "DE CASA EM CASA. Ofereça um estudo bíblico. (3 min)"' }
          }
        }
      },
      living: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Título completo da parte, ex: "Case-se Somente no Senhor (8 min)"' }
          }
        }
      },
      finalSong: { type: 'STRING', description: 'O cântico final, ex: "Cântico 44"' },
      finalComments: { type: 'STRING', description: 'Os comentários finais, ex: "Comentários finais (3 min)"' }
    }
  };

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    }
  };

  // Faz a chamada para a API do Gemini
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Gemini API Error:", errorBody);
    // Tenta analisar o erro do Gemini, se possível
    try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error && errorJson.error.message) {
            throw new Error(`Gemini API error: ${errorJson.error.message}`);
        }
    } catch(e) {
        // Ignora se não for JSON e usa o status
    }
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  // Extrai o texto JSON da resposta
  if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0].text) {
    const jsonText = result.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
  } else {
    console.error("Gemini API Resposta Inesperada:", result);
    throw new Error('Resposta inesperada da API Gemini.');
  }
}

// Esta é a rota POST que sua página irá chamar
export async function POST(req) {
  try {
    // Pega o "textContent" que o cliente enviou
    const { textContent } = await req.json();

    if (!textContent) {
      return NextResponse.json({ message: 'Nenhum conteúdo de texto fornecido.' }, { status: 400 });
    }

    // Chama a função Gemini aqui no servidor
    const parsedData = await callGeminiToParse(textContent);

    // Retorna o JSON processado para o cliente
    return NextResponse.json(parsedData, { status: 200 });

  } catch (error) {
    console.error('Erro na API /api/admin/parse-rtf:', error);
    // Retorna uma mensagem de erro clara para o cliente
    return NextResponse.json({ message: error.message || 'Falha ao processar o arquivo no servidor.' }, { status: 500 });
  }
}