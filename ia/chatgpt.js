require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Genera una respuesta usando OpenAI (GPT-4o).
 * @param {Array} mensajes - Lista de mensajes en formato [{ role, content }]
 * @returns {Promise<string>} - Respuesta generada por la IA
 */
async function generarRespuesta(mensajes) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: mensajes,
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Error en generarRespuesta:', error?.response?.data || error.message);
    return 'Lo siento, ocurrió un error al generar la respuesta.';
  }
}

module.exports = { generarRespuesta };
