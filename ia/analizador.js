// ia/analizador.js

function analizarMensaje(texto) {
  const mensaje = texto.toLowerCase().trim();

  if (mensaje.includes('soy artista') || mensaje.includes('artista visual')) {
    return 'bienvenida.artista';
  }

  if (
    mensaje.includes('tengo un comercio') ||
    mensaje.includes('vendo productos') ||
    mensaje.includes('soy emprendedor')
  ) {
    return 'bienvenida.comercio';
  }

  if (
    mensaje.includes('qué tecnología usan') ||
    mensaje.includes('p5.js') ||
    mensaje.includes('processing')
  ) {
    return 'tecnologias_creativas';
  }

  if (
    mensaje.includes('me interesa una página') ||
    mensaje.includes('quiero una web') ||
    mensaje.includes('hacer una web') ||
    mensaje.includes('necesito una página')
  ) {
    return 'propuesta_llamada';
  }

  if (
    mensaje.includes('puedo esta semana') ||
    (mensaje.includes('día') && mensaje.includes('hora')) ||
    mensaje.includes('cuándo podríamos')
  ) {
    return 'propuesta_horarios';
  }

  if (
    mensaje.includes('confirmado') ||
    mensaje.includes('agendado') ||
    mensaje.includes('perfecto') ||
    mensaje.includes('quedamos así')
  ) {
    return 'confirmacion_agenda';
  }

  return null; // No coincide → pasa a ChatGPT
}

module.exports = { analizarMensaje };
