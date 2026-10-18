# Espectra · NSR-10

**[Abrir la aplicación →](https://yojemr.github.io/Espectra-NSR10/)** · [Repositorio](https://github.com/Yojemr/Espectra-NSR10) · [Historial de cambios](CHANGELOG.md)

Calculadora interactiva de los espectros elásticos generales de **pseudoaceleración, pseudovelocidad y desplazamiento** del capítulo A.2 de la NSR-10 colombiana, como funciones del período de vibración.

Funciona en GitHub Pages y abriendo `index.html` localmente. El cálculo se ejecuta en el navegador; no requiere cuenta, servidor de cálculo ni instalación.

**Versión interna actual: 0.3.0**. La primera versión publicada corresponde a la versión interna 0.1.0.

## Funciones

- Catálogo de localidades de la NSR-10 e ingreso manual de parámetros.
- Cálculo de factores de sitio, importancia y períodos de transición.
- Tres gráficas sincronizadas, consulta por período y sustitución numérica.
- Guardado y apertura de casos, exportación CSV y gráficas SVG.
- Modos claro y oscuro, con controles y gráficas adaptados al tema.
- Interfaz adaptable y oscilador conceptual de un grado de libertad.

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

Para utilizar la aplicación basta abrir `index.html`. Para trabajar mediante HTTP:

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
assets/theme.js             Preferencia y cambio de tema
assets/engine.js            Motor numérico NSR-10
assets/charts.js            Gráficas, selección y exportación SVG
assets/oscillator.js        Animación ilustrativa y control de movimiento
assets/cases.js             Validación de casos y celdas CSV
assets/app.js               Coordinación de la interfaz
assets/style.css            Diseño adaptable y ambos modos
data/municipios.js          Catálogo normativo con trazabilidad
tests/                      Pruebas numéricas y de casos
tools/check_source.cjs      Integridad de HTML, recursos y sintaxis
tools/extract_catalog.py    Extracción reproducible del catálogo
```

Para regenerar el catálogo, con Python, `pypdf` y `pdfplumber`:

```sh
python tools/extract_catalog.py ruta/al/titulo-a-nsr-100.pdf
```

El archivo generado se mantiene fuera del formateador para conservar su reproducibilidad.

## Publicación

Sitio desplegado: **[yojemr.github.io/Espectra-NSR10](https://yojemr.github.io/Espectra-NSR10/)**.

GitHub Pages publica la raíz de `main`. El archivo `.nojekyll` permite servir directamente los recursos y las rutas internas son relativas. Cada cambio en `main` genera un nuevo despliegue, cuyo estado se consulta en **Actions → pages build and deployment**.

El cálculo y los archivos de casos se procesan en el navegador. La preferencia de tema se conserva localmente cuando está permitido.
