# Espectra · NSR-10

**[Abrir la aplicación →](https://yojemr.github.io/Espectra-NSR10/)** · [Repositorio](https://github.com/Yojemr/Espectra-NSR10) · [Historial de cambios](CHANGELOG.md)

Aplicación para explorar los espectros elásticos de **pseudoaceleración, pseudovelocidad y desplazamiento** de la NSR-10 y desarrollar un **modelo preliminar de edificio y columnas**, con comparación DMO/DES.

**Autor:** Juan Esteban Maya Rodriguez.

Funciona en GitHub Pages. El cálculo se ejecuta en el navegador; no requiere cuenta ni servidor de cálculo. El módulo de espectros también permite abrir `index.html` directamente. El módulo estructural usa un Web Worker y requiere GitHub Pages o un servidor HTTP local.

**Versión del código: 0.5.1**. El sitio público corresponde a la última revisión integrada en `main`; una rama o pull request no cambia automáticamente la página publicada. La primera versión publicada corresponde a la versión interna 0.1.0.

## Funciones

- Catálogo de localidades de la NSR-10 e ingreso manual de parámetros.
- Cálculo de factores de sitio, importancia y períodos de transición.
- Tres gráficas sincronizadas, consulta por período y sustitución numérica.
- Guardado y apertura de casos, exportación CSV y gráficas SVG.
- Modos claro y oscuro, con controles y gráficas adaptados al tema.
- Interfaz adaptable y oscilador conceptual de un grado de libertad.
- Acceso directo al repositorio desde la página.
- Modelo gráfico del edificio, selección de columna/piso y vistas 3D y en planta.
- Visores 3D interactivos del edificio y la columna: giro, desplazamiento, zoom y encuadre; concreto sólido, transparente, en corte u oculto para inspeccionar refuerzo.
- Cargas gravitacionales, fuerzas sísmicas, derivas elásticas y diagnóstico de estabilidad.
- Combinaciones concurrentes, interacción biaxial y detallado preliminar de columnas DMO/DES.
- Proyectos estructurales JSON y exportación CSV de combinaciones, separados de los casos de espectros.

## Edificio y columnas

Accede desde la pestaña **Edificio y columnas** (`estructura.html`). Es una primera etapa de desarrollo: **no constituye un diseño estructural completo ni emite una certificación de cumplimiento de la NSR-10**.

1. Revisa el municipio, perfil de suelo, grupo de uso y cargas del proyecto.
2. Edita ejes, paneles omitidos, pisos, vigas, materiales y sección uniforme de columnas.
3. Selecciona una columna y un tramo. **Calcular edificio** actualiza el modelo y ambos niveles de disipación.
4. Consulta demanda concurrente, interacción biaxial, estribos, distribución sísmica y combinaciones.
5. Para columna fuerte–viga débil, ingresa las capacidades **nominales Mnb**, positivas y negativas, en las caras del nudo superior y su fuente. No se calculan ni se inventan capacidades de vigas a partir de su geometría.
6. Guarda un proyecto JSON para reproducir sus entradas. El CSV exporta todas las combinaciones de la columna y el piso elegidos.

Un cambio de entradas marca los resultados anteriores y bloquea su exportación hasta recalcular. Los archivos importados se validan antes de sustituir el proyecto. Las capacidades faltantes se conservan como pendientes; un axial fuera del intervalo resistente no produce un contorno biaxial ficticio.

En el CSV estructural, las excentricidades accidentales se expresan como fracción de la dimensión perpendicular: e de Ex / Ly y e de Ey / Lx. En combinaciones sin componente sísmica se exportan como cero. Los esfuerzos conservan sus signos y se expresan en kN y kN·m.

### Visores 3D

El edificio completo permite **girar, acercar, desplazar y seleccionar una columna y un piso con un clic**. La selección actualiza el tramo analizado y su resaltado. El control **Losas** facilita ver el pórtico interior. La planta SVG conserva la lectura de ejes y paneles.

La columna se representa en escala geométrica a partir de b, h, tramo libre, recubrimiento, diámetros, posiciones de barras, ramas y niveles de estribos del régimen DMO/DES seleccionado. Permite mostrar concreto sólido, transparente, abierto mediante un corte longitudinal u oculto. Las barras y los estribos se pueden ocultar por separado. La textura de concreto y el corrugado son ilustrativos; el corte es una herramienta de inspección, no una abertura del elemento.

El refuerzo transversal utiliza barras continuas con dobleces redondeados y ganchos de 135°, con extensión ≥ máx.(6dₜ, 75 mm), según C.7.1.4. El diámetro interior mínimo de doblado sigue C.7.2.2: 4dₜ para estribos No. 3 a No. 5 y 6dₜ para No. 6 a No. 8. La geometría también permite alojar la barra longitudinal abrazada. Las posiciones de las barras de esquina se ajustan a esos dobleces y se comparten entre cálculo, sección SVG y modelo 3D; el área de acero se conserva. Los cierres y ganchos suplementarios alternan entre niveles y se separan en altura para representar su montaje.

La disposición implementada es un cerco perimetral con ganchos suplementarios apoyados en barras longitudinales: ramas X ≤ ny y ramas Y ≤ nx. Se rechazan disposiciones que no alojan los dobleces y extensiones dentro del recubrimiento. La geometría representada no verifica por sí sola anclajes, empalmes, interferencias de montaje ni todos los requisitos de apoyo lateral de barras.

Las láminas de sección y alzado incluyen ejes, cotas de dimensiones, recubrimiento y longitud de confinamiento, unidades y llamadas del refuerzo. El ancho del alzado se amplifica para facilitar su lectura. Las claves breves explican los resultados en cada sección de la aplicación; las fórmulas y los valores se distinguen del texto auxiliar.

- Ratón: arrastrar gira; rueda acerca; botón derecho y arrastre desplazan.
- Táctil: un dedo gira; dos dedos permiten acercar y desplazar.
- Teclado, con el visor enfocado: flechas giran; `+` y `−` cambian el acercamiento; `Inicio` encuadra.
- Los botones de giro, zoom y encuadre ofrecen controles alternativos.

Se requiere **WebGL 2**. Si no está disponible, se conservan los esquemas SVG y el cálculo numérico. El renderizado se actualiza al interactuar o cambiar datos; no hay un bucle continuo de animación. Se liberan los recursos al sustituir geometrías y cerrar la página.

La biblioteca [Three.js](https://threejs.org/) **0.187.0** y OrbitControls se sirven desde `assets/vendor/three/`, con su licencia MIT. No se cargan desde una CDN. Las copias publicadas se verifican byte por byte contra la dependencia fijada en `package-lock.json` mediante `npm run check`. `npm run vendor:sync` las reproduce desde `node_modules` después de `npm ci`. La dependencia se utiliza para visualización y no interviene en los cálculos estructurales.

### Caso inicial de Santa Marta

| Entrada                        | Valor                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| Municipio                      | Santa Marta, Magdalena · 47001 · Aa = 0,15; Av = 0,10        |
| Perfil / grupo de uso del caso | C / I, sujetos a confirmación del proyecto                   |
| Elevación                      | 12 pisos de 2,80 m                                           |
| Ejes X                         | 0; 7; 15; 22; 28 m                                           |
| Ejes Y                         | 0; 7,5; 15; 21,5 m                                           |
| Panel omitido                  | Primer vano X, tercera fila Y                                |
| Planta resultante              | 556,50 m²; 19 columnas y 29 tramos de viga por piso          |
| D / L superficiales            | 6,3281646655 / 5,00 kN/m²                                    |
| Vigas / losa equivalente       | 0,30 × 0,50 m / 0,12181818 m                                 |
| f′c / fy / fyt / γ concreto    | 21 / 420 / 420 MPa / 24 kN/m³                                |
| Sección inicial                | 400 × 400 mm; 8 barras No. 6; recubrimiento al estribo 40 mm |
| Coeficientes iniciales         | φa = 1; φp = 0,9; φr = 1; R0 DMO = 5; R0 DES = 7             |

La sección inicial se conserva para estudiar el caso y **resulta insuficiente**. No es una sección diseñada ni una recomendación de construcción. El refuerzo, las confirmaciones de hipótesis y las capacidades de vigas son datos editables o pendientes según corresponda. La transferencia de cargas a 45°, las rigideces efectivas y la idealización de apoyos/diafragma deben justificarse para el edificio real.

### Método y comprobaciones implementadas

- Pórtico espacial de barras Euler–Bernoulli; seis grados de libertad por nudo antes de imponer diafragmas rígidos en planta y empotramientos de base. Solución por Cholesky, con límites de tamaño y rechazo de matrices singulares.
- Rigidez Ec = 4700√f′c (MPa), G = Ec/[2(1+ν)], factores efectivos de flexión editables. La rigidez torsional de cada barra usa el mismo factor de su sección.
- Cargas superficiales a las vigas mediante áreas tributarias a 45° y cargas consistentes. Peso propio de vigas descontando la losa equivalente y peso de columnas. Se comprueba el equilibrio gravitacional por reacciones.
- El peso sísmico se concentra por niveles; cada segmento de columna aporta la mitad a cada extremo. La mitad adyacente a la base fija no se incorpora a la masa elevada.
- Fuerza horizontal equivalente (FHE): estimación estática de T mediante Rayleigh, límite Cu·Ta, distribución por Wi·hi^k, torsión inherente del modelo y excentricidad accidental ±5 %. Es una estimación de período, **no un análisis modal**. La comprobación de elegibilidad FHE es parcial y no sustituye revisar A.3.4.2 para el caso específico.
- Combinaciones de resistencia implementadas: 1,4D; 1,2D+1,6L; 1,2D+L±E; 0,9D±E. E combina 100/30 con signos y excentricidades independientes. Se evalúan ambos extremos de columna y siete patrones discretos de L: uniforme, alternados por paneles X/Y y pisos. Solo E se divide por R = φaφpφrR0.
- Sección rectangular con barras simétricas perimetrales: compatibilidad de deformaciones, εcu = 0,003, bloque equivalente, fluencia del acero, concreto desplazado por barras y φ según deformación de tracción. Superficie biaxial con 96 orientaciones y discretización de profundidad del eje neutro; corte al Pu concurrente y comprobación radial de momentos. Límite axial de columna con estribos: 0,75·0,65·Po (C.10.3.6.2).
- Detallado DMO/DES: cuantía, geometría, separación libre, recubrimiento interior base, diámetro de estribos, confinamiento y espaciamientos. Los resultados distinguen el espaciamiento geométrico del límite por área de refuerzo transversal.
- Cortante por capacidad: momentos nominales DMO y probables DES con 1,25fy; alternativa Ω0E donde corresponde. Resistencia conservadora con **Vc = 0, φ = 0,60** y el mayor espaciamiento editado. Si existen axiales fuera del intervalo resistente, Ve permanece pendiente.
- Columna fuerte–viga débil: ΣMnc ≥ 1,2ΣMnb en cada dirección, usando axiales concurrentes de las columnas y la reversión más exigente de capacidades nominales de vigas suministradas.

### Diagramas de interacción

La sección dispone de diagramas **P–Mx y P–My** independientes. Cada gráfico distingue la resistencia nominal `Pn–Mn`, la resistencia de diseño `φPn–φMn` y las proyecciones de las combinaciones concurrentes del régimen seleccionado. Los momentos se muestran en magnitud, dado el armado simétrico; los signos se conservan en el cálculo y en el corte biaxial. Las curvas de ambos ejes pueden coincidir en secciones cuadradas con el mismo armado por dirección.

La ventana completa conserva todas las demandas. La ventana de detalle encuadra la resistencia e identifica cuántos puntos quedan fuera de ella. Seleccionar una combinación destaca sus proyecciones y actualiza el corte biaxial a su `Pu`. El corte Mx–My mantiene la misma escala en ambos ejes. La exploración de otro axial no superpone demandas con un `Pu` diferente; un axial fuera del intervalo resistente no genera un contorno ficticio.

El límite para columnas con estribos es **φPn,max = 0,75·0,65·P₀**, según C.10.3.6.2, con `P₀ = [0,85f′c(Ag−As)+fyAs]/1000` en kN para entradas MPa/mm. La versión 0.5.1 corrige el coeficiente 0,80 usado en 0.5.0. Para la sección inicial, `P₀ = 3.769,6848 kN` y `φPn,max = 1.837,72134 kN`. El corte de la curva se obtiene por intersección con ese límite, sin trasladar puntos de mayor axial a una ordenada inferior. Los extremos de tracción y compresión puras tienen momento nulo.

La tabla de estados muestra valores nominales y φ para cada eje. Las etiquetas y las tablas se redondean para facilitar la lectura; los cálculos y las comprobaciones conservan la precisión interna. Los cambios de pendiente de la curva de diseño responden al estado de deformación y a la variación de φ. Las comprobaciones uniaxiales por separado no reemplazan la verificación biaxial.

### Condiciones y alcance del análisis

El análisis es de **primer orden**. Se muestran Q y Ax como diagnósticos; no se aplica automáticamente P-Δ ni amplificación Ax > 1 a los esfuerzos. El alcance no incluye análisis de segundo orden, esbeltez local, verificación de flexibilidad del diafragma, evaluación completa de irregularidades y restricciones del sistema según amenaza/uso/altura, exposición y durabilidad, comprobación completa del apoyo lateral de barras, empalmes, anclajes, tamaño de agregado, diseño de vigas y losas, cortante de nudos ni cimentaciones.

La sección es uniforme en todo el edificio. No hay perfiles independientes por columna o piso, muros, resortes de apoyo, diafragmas flexibles ni análisis modal. Las familias de carga implementadas no incluyen viento, nieve, presión de suelo, fluidos o cargas especiales de cubierta. Estas cargas y otros elementos solo quedan representados si están debidamente incorporados a las entradas aplicables. Los siete patrones de carga viva no agotan todas las distribuciones posibles.

Referencias principales: títulos A, B y [C de la NSR-10](https://www.idrd.gov.co/sites/default/files/documentos/Construcciones/3titulo-c-nsr-100.pdf); [Decreto 092 de 2011](https://normas.cra.gov.co/gestor/docs/decreto_0092_2011.htm) y [Decreto 340 de 2012](https://normas.cra.gov.co/gestor/docs/decreto_0340_2012.htm). Se revisaron también las modificaciones de los decretos 945 de 2017 y 1711 de 2021 para delimitar el alcance. La interfaz identifica las referencias de cada comprobación implementada; una comprobación satisfecha no implica cumplimiento global del edificio.

## Guía de uso

1. **Define el sitio.** Selecciona departamento y municipio. Se cargan `Aa` y `Av`. En **Ingreso manual**, introduce el sitio, sus parámetros y la fuente.
2. **Define las condiciones.** Selecciona perfil de suelo y grupo de uso. Se calculan `Fa`, `Fv` e `I`.
3. **Explora los espectros.** Selecciona un período desde la gráfica, el deslizador o el campo numérico. Consulta sus tres ordenadas y la sustitución numérica.
4. **Conserva el trabajo.** Usa **Guardar caso**, **Abrir caso** o **Datos CSV** en la barra destacada. Cada gráfica tiene su propia descarga SVG.

El ejemplo inicial corresponde a **Medellín, perfil D y grupo I**. Es un caso editable de demostración.

En **Configuración del espectro** puedes modificar el período máximo, el paso de la tabla y el tramo inicial para modos superiores. Esta última opción corresponde exclusivamente a modos distintos del fundamental de la dirección analizada.

### Apariencia

El primer acceso respeta la preferencia del sistema. El control de la cabecera permite cambiar de modo y recordar la elección en el almacenamiento local. Si el navegador restringe ese almacenamiento, el cambio sigue funcionando durante la sesión. Cambiar el tema no modifica las entradas ni los resultados.

### Archivos

| Formato | Contenido                                 | Uso                                               |
| ------- | ----------------------------------------- | ------------------------------------------------- |
| JSON    | Entradas, unidades y período seleccionado | Reabrir el caso y recalcularlo                    |
| CSV     | Ordenadas, parámetros, sitio y fuente     | Analizar los resultados en una hoja de cálculo    |
| SVG     | Gráfica vectorial en el tema seleccionado | Insertar o editar la figura sin perder resolución |

Los casos de la versión interna 0.1 siguen siendo compatibles. La versión del formato JSON se mantiene en `1`, independientemente de la versión de la aplicación. Los archivos se validan antes de modificar las entradas actuales.

El CSV utiliza punto y coma como separador y punto decimal. Sus unidades son `s`, `g`, `m/s` y `m`, aunque se seleccione otra unidad de visualización. Los campos de texto protegen frente a prefijos de fórmula de hojas de cálculo.

### Animación del oscilador

El esquema oscila automáticamente de izquierda a derecha con un período visual asociado a `T`. **Pausar animación** y **Reproducir animación** permiten controlar el movimiento. Cambiar el período actualiza la oscilación; los cambios de tema y de unidades no la reinician.

La posición ilustrativa sigue `u(t) = A sen(2πt/T)`, con amplitud gráfica fija y sin escala física. No es una integración del movimiento sísmico ni una respuesta temporal derivada del espectro. Las curvas normativas y sus valores se calculan de forma independiente.

Para `T < 0,4 s` se utiliza un período visual mínimo de `0,4 s` y se indica explícitamente que el movimiento está ralentizado. En `T = 0`, el límite rígido permanece centrado. Al ocultar la pestaña se suspende el movimiento. Si el navegador solicita movimiento reducido, la animación inicia en pausa; el usuario puede reproducirla explícitamente.

## Fundamento normativo

Fuente: **[NSR-10, Título A, publicado por el IDRD](https://www.idrd.gov.co/sites/default/files/documentos/Construcciones/titulo-a-nsr-100.pdf)**.

| Componente                                          | Referencia                          |
| --------------------------------------------------- | ----------------------------------- |
| `Aa`, `Av` y amenaza municipal                      | Apéndice A-4, páginas A-153 a A-174 |
| Factores de sitio `Fa` y `Fv`                       | Tablas A.2.4-3 y A.2.4-4            |
| Coeficiente de importancia `I`                      | Tabla A.2.5-1                       |
| Pseudoaceleración, pseudovelocidad y desplazamiento | A.2.6.1, A.2.6.2 y A.2.6.3          |

Se conservan las expresiones y coeficientes de las ecuaciones A.2.6-1 a A.2.6-15, para **5 % del amortiguamiento crítico**, sin reducción por `R`. `Fa` se interpola por `Aa` y `Fv` por `Av`; se aplican las columnas extremas fuera de los intervalos intermedios de las tablas.

Cada espectro se evalúa por separado. Los coeficientes redondeados producen pequeños saltos en `Sv` y `Sd` en `TC`; no se fuerza continuidad ni identidad algebraica exacta entre curvas. Se usa la rama izquierda en `TC` y `TL`. En `T = 0` se evalúan los límites finitos de la rama inicial.

`Sa` se expresa como fracción de `g`; su conversión a `m/s²` utiliza `g = 9,80665 m/s²`. `Sv` se expresa en `m/s` y `Sd` en `m`.

### Cobertura y alcance

El catálogo contiene **1.117 localidades únicas** de 32 departamentos y Bogotá, D. C. Los nombres y códigos corresponden al documento normativo y no a una actualización administrativa. Bogotá aparece dos veces con idénticos parámetros; se conserva una entrada y se registran ambas páginas de origen.

Las localidades ausentes pueden utilizar ingreso manual con una fuente documentada. No se atribuyen parámetros por proximidad.

Los perfiles F y los sitios con microzonificación o estudio particular aplicable requieren sus propios espectros. En esos casos se detiene el cálculo general. La aplicación implementa las curvas generales de A.2.6; no genera espectros particulares ni reemplaza estudios de sitio.

El oscilador es conceptual y sin escala. Su movimiento ilustra el período seleccionado y no representa un edificio calculado ni la historia temporal de un sismo.

### Trazabilidad

Cada registro incluye código, parámetros y página de origen. La extracción compara `pypdf` y `pdfplumber`, verifica códigos y amenaza, y deduplica únicamente registros idénticos.

SHA-256 del PDF de 186 páginas utilizado:

```text
8a266a10938bbd91001cf1220d1c3503b0b7eecfa23f6d38a1bbc8685cda565f
```

## Desarrollo local

Para utilizar ambos módulos, sirve la carpeta mediante HTTP. El módulo estructural puede ser bloqueado por el navegador si se abre con `file://`:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Abrir [localhost:8765](http://127.0.0.1:8765/).

Las herramientas de desarrollo requieren **Node.js 22 o posterior** y npm. Las dependencias de desarrollo no se cargan en la aplicación publicada.

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run format:check
```

Para aplicar el formato uniforme:

```sh
npm run format
```

La verificación continua ejecuta las pruebas, las comprobaciones de integridad y el formato en cada actualización y solicitud de cambios.

### Organización

```text
index.html                  Interfaz y fundamento normativo
estructura.html             Edificio y columnas DMO/DES
assets/theme.js             Preferencia y cambio de tema
assets/engine.js            Motor numérico NSR-10
assets/charts.js            Gráficas, selección y exportación SVG
assets/oscillator.js        Animación ilustrativa y control de movimiento
assets/cases.js             Validación de casos y celdas CSV
assets/app.js               Coordinación de la interfaz
assets/style.css            Diseño adaptable y ambos modos
assets/project.js           Esquema validado y geometría del proyecto
assets/frame.js             Pórtico 3D, cargas, solución y equilibrio
assets/reinforcement.js     Geometría compartida de barras, estribos y ganchos
assets/section.js           Compatibilidad, interacción y detallado
assets/building.js          FHE, combinaciones y comparación DMO/DES
assets/structure-worker.js  Cálculo estructural fuera del hilo de interfaz
assets/structure-ui.js      Entradas, proyectos y resultados estructurales
assets/structure-view.js    Modelos y gráficas SVG estructurales
assets/structure-3d.js      Visores WebGL interactivos y selección de elementos
assets/vendor/three/        Biblioteca gráfica local y licencia MIT
assets/structure.css        Interfaz adaptable del módulo estructural
data/municipios.js          Catálogo normativo con trazabilidad
tests/                      Pruebas numéricas y de casos
tools/check_source.cjs      Integridad de HTML, recursos y sintaxis
tools/extract_catalog.py    Extracción reproducible del catálogo
tools/sync_vendor.cjs       Copia y verificación de la biblioteca gráfica
```

Para regenerar el catálogo, con Python, `pypdf` y `pdfplumber`:

```sh
python tools/extract_catalog.py ruta/al/titulo-a-nsr-100.pdf
```

El archivo generado se mantiene fuera del formateador para conservar su reproducibilidad.

### Validación

Las pruebas incluyen espectros y catálogo completo, compatibilidad de casos anteriores, oscilador, soluciones analíticas de barra/ménsula, equilibrio de cargas consistentes y reacciones globales, capacidad axial independiente, deformaciones y φ, flexión biaxial y convergencia angular, combinaciones y conservación de cargas gravitacionales entre DMO/DES, y regresiones de espaciamientos. La geometría de refuerzo se contrasta con radios mínimos, extensiones de ganchos, recubrimiento, ajuste de esquinas, simetría y profundidad efectiva. La revisión de navegador cubre importación/exportación, datos inválidos, actualización del modelo, temas y vistas móviles.

### Flujo de Git y GitHub

1. Parte de `main` actualizado y crea una rama `feat/...`, `fix/...` o `docs/...`.
2. Conserva commits pequeños y coherentes con mensajes Conventional Commits; separa motor, interfaz y documentación cuando facilite la revisión.
3. Antes de cada commit, revisa estado, archivos preparados y diff. Excluye credenciales, datos privados, rutas locales, libros fuente, capturas y archivos de prueba temporales.
4. Ejecuta las pruebas, integridad y formato; comprueba visualmente los cambios de interfaz.
5. Abre un pull request a `main`, documenta comportamiento, alcance y validación. Integra después de revisar el diff y los checks.
6. Verifica el commit remoto, las acciones y el sitio publicado. No uses force push ni reescribas historial público sin autorización.

El flujo de checks tiene permisos de lectura y acciones fijadas por SHA. Se ejecuta en pull requests y en actualizaciones de `main`, `feat/**` y `fix/**`. La plantilla de PR recoge cambios, validación y alcance. Las reglas efectivas de protección de ramas se administran en GitHub y no quedan activadas por este documento.

## Publicación

Sitio desplegado: **[yojemr.github.io/Espectra-NSR10](https://yojemr.github.io/Espectra-NSR10/)**.

GitHub Pages publica la raíz de `main`. El archivo `.nojekyll` permite servir directamente los recursos y las rutas internas son relativas. Cada cambio en `main` genera un nuevo despliegue, cuyo estado se consulta en **Actions → pages build and deployment**.

El cálculo y los archivos de casos/proyectos se procesan en el navegador. No se envían a un servicio de cálculo. La preferencia de tema se conserva localmente cuando está permitido. No se necesita un despliegue adicional para el modelo estructural.
