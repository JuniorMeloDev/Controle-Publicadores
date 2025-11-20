import { NextResponse } from 'next/server';

// Esta é a função que chama a API do Gemini.
async function callGeminiToParse(text) {
  const apiKey = process.env.GEMINI_API_KEY; 
  
  // --- CORREÇÃO AQUI ---
  // Revertendo para o nome do modelo original que estava funcionando.
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  // --- FIM DA CORREÇÃO ---

  // O prompt para extrair o TEXTO COMPLETO (como solicitado) permanece.
  const systemPrompt = `
    Você é um assistente que extrai programações de reunião de arquivos de texto (RTF) da Apostila da Reunião "Nossa Vida e Ministério Cristão".
    Sua tarefa é ler o texto e retornar um objeto JSON estruturado com base no schema fornecido.
    Extraia os títulos COMPLETOS das partes, incluindo o tempo e quaisquer instruções ou subtítulos, exatamente como aparecem no texto.
  `;

  const userQuery = `
    Por favor, extraia as informações da reunião deste texto e formate como JSON:
    ---
    ${text}
    ---
  `;

  // O Schema JSON (com as instruções de texto completo) permanece.
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
            title: { type: 'STRING', description: 'Título completo da parte, incluindo tempo. ex: "A importância da beleza interior (10 min)"' }
          }
        }
      },
      ministry: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Título completo da parte, incluindo tempo e instruções. ex: "Iniciando conversas: (2 min) DE CASA EM CASA. Ofereça um estudo bíblico. (lmd lição 6 ponto 4)"' }
          }
        }
      },

      middleSong: { type: 'STRING', description: 'O cântico que ocorre entre a seção do Ministério e a seção Nossa Vida Cristã. Ex: "Cântico 105"' },

      
      living: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Título completo da parte, incluindo tempo e subtítulo. ex: "Estudo bíblico de congregação (30 min): (bt cap. 5 pars. 1-8)"' }
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

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Gemini API Error:", errorBody);
    try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error && errorJson.error.message) {
            throw new Error(`Gemini API error: ${response.status} ${errorJson.error.message}`);
        }
    } catch(e) {
        // Ignora
    }
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0].text) {
    const jsonText = result.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
  } else {
    console.error("Gemini API Resposta Inesperada:", result);
    throw new Error('Resposta inesperada da API Gemini.');
  }
}

// Rota POST
export async function POST(req) {
  try {
    const { textContent } = await req.json();

    if (!textContent) {
      return NextResponse.json({ message: 'Nenhum conteúdo de texto fornecido.' }, { status: 400 });
    }

    const parsedData = await callGeminiToParse(textContent);

    return NextResponse.json(parsedData, { status: 200 });

  } catch (error) {
    console.error('Erro na API /api/admin/parse-rtf:', error);
    return NextResponse.json({ message: error.message || 'Falha ao processar o arquivo no servidor.' }, { status: 500 });
  }
}