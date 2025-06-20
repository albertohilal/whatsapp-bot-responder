// ia/analizador.js

function analizarMensaje(texto) {
  const mensaje = texto.toLowerCase().trim();

  if (mensaje.includes('soy artista') || mensaje.includes('artista visual')) {
    return 'bienvenida.artista';
  }

  if (mensaje.includes('tengo un comercio') || mensaje.includes('vendo productos') || mensaje.includes('soy emprendedor')) {
    return 'bienvenida.comercio';
  }

  if (mensaje.includes('qué tecnología usan') || mensaje.includes('p5.js') || mensaje.includes('processing')) {
    return 'tecnologias_creativas';
  }

  if (mensaje.includes('me interesa una página') || mensaje.includes('quiero una web')) {
    return 'propuesta_llamada';
  }

  if (mensaje.includes('puedo esta semana') || mensaje.includes('día') && mensaje.includes('hora')) {
    return 'propuesta_horarios';
  }

  if (mensaje.includes('confirmado') || mensaje.includes('agendado') || mensaje.includes('perfecto')) {
    return 'confirmacion_agenda';
  }

  return null; // no coincide con nada → usar ChatGPT
}

module.exports = { analizarMensaje };
