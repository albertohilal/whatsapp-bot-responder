// Script para corregir los mensajes invertidos en ll_ia_conversaciones
// Intercambia los valores de 'rol' y 'mensaje' cuando están invertidos

require('dotenv').config();
const pool = require('../db/pool');

async function fixConversaciones() {
  try {
    console.log('🔧 Iniciando corrección de conversaciones...\n');
    
    // 1. Contar registros con problema (mensaje = 'usuario', 'bot', 'ia')
    const [problema] = await pool.execute(`
      SELECT COUNT(*) as total 
      FROM ll_ia_conversaciones 
      WHERE mensaje IN ('usuario', 'bot', 'ia')
    `);
    
    console.log(`📊 Registros con problema detectados: ${problema[0].total}`);
    
    if (problema[0].total === 0) {
      console.log('✅ No hay registros que corregir');
      process.exit(0);
    }
    
    // 2. Mostrar algunos ejemplos
    const [ejemplos] = await pool.execute(`
      SELECT id, telefono, SUBSTRING(rol, 1, 100) as rol_preview, mensaje 
      FROM ll_ia_conversaciones 
      WHERE mensaje IN ('usuario', 'bot', 'ia')
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📝 Ejemplos de registros con problema (ANTES):');
    ejemplos.forEach(e => {
      console.log(`\n  ID: ${e.id}`);
      console.log(`    ROL (tiene el mensaje): "${e.rol_preview}..."`);
      console.log(`    MENSAJE (tiene el rol): "${e.mensaje}"`);
    });
    
    // 3. Hacer el intercambio directamente
    console.log(`\n🔄 Se intercambiarán los valores de 'rol' y 'mensaje' en ${problema[0].total} registros`);
    
    // 4. Hacer el intercambio
    console.log('\n🔄 Realizando corrección...');
    
    // Obtener todos los registros problemáticos
    const [registros] = await pool.execute(`
      SELECT id, rol, mensaje 
      FROM ll_ia_conversaciones 
      WHERE mensaje IN ('usuario', 'bot', 'ia')
    `);
    
    console.log(`   Procesando ${registros.length} registros...`);
    
    // Intercambiar uno por uno
    for (const reg of registros) {
      await pool.execute(`
        UPDATE ll_ia_conversaciones 
        SET rol = ?, mensaje = ? 
        WHERE id = ?
      `, [reg.mensaje, reg.rol, reg.id]);
    }
    
    console.log('✅ Corrección completada');
    
    // 5. Verificar resultado
    const [verificacion] = await pool.execute(`
      SELECT COUNT(*) as total 
      FROM ll_ia_conversaciones 
      WHERE mensaje IN ('usuario', 'bot', 'ia')
    `);
    
    console.log(`\n📊 Registros con problema después de la corrección: ${verificacion[0].total}`);
    
    // 6. Mostrar algunos registros corregidos
    const [corregidos] = await pool.execute(`
      SELECT id, telefono, rol, SUBSTRING(mensaje, 1, 80) as mensaje_preview 
      FROM ll_ia_conversaciones 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n✅ Ejemplos de registros corregidos (DESPUÉS):');
    corregidos.forEach(e => {
      console.log(`\n  ID: ${e.id}`);
      console.log(`    ROL: "${e.rol}"`);
      console.log(`    MENSAJE: "${e.mensaje_preview}..."`);
    });
    
    console.log('\n🎉 Proceso completado exitosamente');
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

fixConversaciones();
