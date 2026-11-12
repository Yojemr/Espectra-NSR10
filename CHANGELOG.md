# Historial de cambios

## 0.5.0 — 2026-11-12

- Módulo de edificio y columnas integrado con los espectros, partiendo de la planta del proyecto de Santa Marta.
- Modelo 3D de pórticos, cargas consistentes, comprobación de equilibrio, FHE y comparación DMO/DES con combinaciones concurrentes.
- Sección rectangular, interacción biaxial por compatibilidad, esquemas de refuerzo y comprobaciones preliminares de confinamiento y cortante.
- Columna fuerte–viga débil con capacidades nominales de vigas ingresadas y documentadas por el usuario.
- Proyectos JSON validados, exportación CSV, resultados anteriores identificados al editar y cálculo en Web Worker.
- Vistas 3D/planta, selección de columna/piso, temas y adaptación móvil; enlace al espectro del sitio seleccionado.
- Visores 3D interactivos con giro, desplazamiento, acercamiento y encuadre. Selección de columna/piso sobre el edificio y concreto sólido, transparente, en corte u oculto en el detalle de refuerzo.
- Three.js local con versión fija, licencia y verificación reproducible; cálculo independiente del visor y alternativa SVG cuando WebGL 2 no está disponible.
- Pruebas analíticas, de equilibrio y de regresión; límites explícitos de primer orden y verificaciones pendientes.
- Desarrollo en rama, plantilla de PR, checks en ramas de trabajo y documentación del flujo de contribución.
- Tablas de comprobaciones y fuerzas completas, unidades explícitas y metadatos de excentricidad diferenciados de los casos de solo gravedad.
- Estribos continuos con dobleces y ganchos de 135°; posiciones de barras compartidas por cálculo y visores, con ajuste de esquinas al radio interior.
- Láminas de planta, sección y alzado con cotas y ejes; claves de lectura en los dos módulos y jerarquía tipográfica para distinguir resultados de ayuda funcional.

## 0.4.0 — 2026-10-18

- Agrega un botón visible para abrir el repositorio de GitHub desde la página.
- Acredita a Juan Esteban Maya Rodriguez como autor en el README.

## 0.3.0 — 2026-10-18

- Sustituye la deformación fija del esquema por una oscilación continua asociada al período seleccionado.
- Incorpora controles de reproducir y pausar, límite rígido en T = 0 y ralentización explícita para períodos cortos.
- Respeta la preferencia de movimiento reducido y suspende la animación cuando la pestaña está oculta.
- Conserva los cálculos espectrales y la compatibilidad de casos anteriores.
- Documenta el comportamiento y el alcance ilustrativo de la animación.

## 0.2.0 — 2026-10-18

- Aviso de JavaScript al inicio de la página.
- Modos claro y oscuro, preferencia del sistema y persistencia local cuando está disponible.
- Gráficas y exportaciones SVG adaptadas al tema seleccionado.
- Acciones de guardar, abrir y exportar destacadas junto a los resultados.
- Oscilador ampliado, visible en escritorio y móvil.
- Separación de temas, gráficas y archivos de casos en módulos específicos.
- Validación de archivos, compatibilidad con casos anteriores y mejores contrastes.
- Formato uniforme, comprobaciones de integridad y verificación continua en GitHub.
- README con acceso a la aplicación publicada, guía de uso y documentación de desarrollo.

## 0.1.0 — 2026-10-18

Versión inicial, identificada internamente como 0,1.

- Tres espectros elásticos conforme a A.2.6 de la NSR-10.
- Catálogo de 1.117 localidades del Apéndice A-4 e ingreso manual.
- Consulta por período, exportación CSV y SVG, guardado y apertura de casos.
- Interfaz adaptable y verificación numérica del motor.
