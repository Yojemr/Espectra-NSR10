# Espectra · NSR-10

Aplicación estática para calcular y graficar los espectros elásticos generales de pseudoaceleración, pseudovelocidad y desplazamiento del capítulo A.2 de la NSR-10 colombiana.

## Uso

Abrir `index.html` en un navegador moderno. No requiere instalación, servidor, cuenta ni conexión para calcular. También funciona cuando se publica en GitHub Pages.

1. Seleccionar departamento y municipio o utilizar **Ingreso manual**, indicando sitio y fuente de los parámetros.
2. Definir perfil de suelo y grupo de uso. Los factores de sitio se interpolan automáticamente.
3. Consultar las tres gráficas y seleccionar un período mediante el deslizador, el campo numérico o un punto de la curva.
4. Exportar datos CSV, descargar gráficas SVG o guardar un caso JSON para abrirlo después.

La pantalla inicial corresponde a un ejemplo editable: Medellín, perfil D y grupo de uso I. Los archivos de caso guardan entradas; al abrirlos se recalculan los resultados.

## Base de cálculo

- Amenaza municipal: Apéndice A-4, páginas A-153 a A-174.
- Coeficientes de sitio: tablas A.2.4-3 y A.2.4-4. Interpolación lineal por Aa para Fa y por Av para Fv; se conservan los valores extremos de las tablas fuera de sus intervalos intermedios.
- Importancia: tabla A.2.5-1.
- Espectros: ecuaciones A.2.6-1 a A.2.6-15; amortiguamiento del 5 % del crítico.
- Espectro general con meseta inicial; opción de tramo inicial reducido exclusivamente para modos distintos del fundamental.
- Sa en fracción de g, Sv en m/s y Sd en m. Conversión de visualización: g = 9,80665 m/s².

Se evalúa cada espectro con sus coeficientes normativos. Los pequeños saltos en Sv y Sd en TC se conservan; no se fuerza continuidad ni identidad algebraica entre expresiones redondeadas. Se utiliza la rama izquierda en las fronteras TC y TL. En T = 0 se evalúan directamente los límites finitos de la rama inicial.

El espectro se presenta sin reducción por R. El esquema de un grado de libertad es ilustrativo y no representa un edificio calculado ni una respuesta temporal.

## Cobertura de los datos

El catálogo contiene **1.117 localidades únicas** del documento normativo, en 32 departamentos y Bogotá, D. C. Los parámetros de Bogotá aparecen dos veces con idénticos valores; se conserva un único registro y se registran ambas páginas en los datos. Los nombres y códigos mantienen la nomenclatura del documento, que no equivale al catálogo administrativo actual. Las localidades ausentes pueden utilizar ingreso manual con una fuente documentada; no se atribuyen parámetros por proximidad.

Los perfiles F y los sitios con microzonificación o estudio particular aplicable requieren sus espectros específicos. La aplicación detiene el cálculo general en esos casos; no genera curvas particulares ni sustituye estudios de sitio.

Fuente normativa: [NSR-10, Título A, publicación del IDRD](https://www.idrd.gov.co/sites/default/files/documentos/Construcciones/titulo-a-nsr-100.pdf).

SHA-256 del PDF usado para extraer los datos: `8a266a10938bbd91001cf1220d1c3503b0b7eecfa23f6d38a1bbc8685cda565f`.

## Estructura

```text
index.html                 Interfaz y fundamento normativo
assets/style.css           Diseño adaptable
assets/engine.js           Motor numérico independiente
assets/app.js              Interacción, gráficas y exportaciones
data/municipios.js         Datos del Apéndice A-4 con referencia por fila
tests/engine.test.cjs      Verificación numérica y de cobertura
tools/extract_catalog.py   Extracción reproducible y contraste de lectores PDF
```

## Verificación

Con Node.js 22 o posterior:

```text
node --test tests/engine.test.cjs
```

Las pruebas incluyen un caso manual de control, interpolaciones, límites, modos superiores, escalamiento por importancia, relaciones físicas con tolerancia de redondeo, errores de entrada y todas las combinaciones de localidad, perfil A–E y grupo de uso I–IV.

Para reconstruir el catálogo desde el PDF de 186 páginas, con Python, pypdf y pdfplumber:

```text
python tools/extract_catalog.py ruta/al/titulo-a-nsr-100.pdf
```

La extracción compara códigos y parámetros de ambas bibliotecas, verifica amenazas y deduplica únicamente registros idénticos.

## GitHub Pages

Publicar el contenido del proyecto en la raíz de un repositorio. En **Settings → Pages**, seleccionar **Deploy from a branch**, la rama correspondiente y la carpeta **/(root)**. El archivo `.nojekyll` permite servir directamente los recursos estáticos. Todas las rutas internas son relativas y funcionan bajo la ruta de un repositorio.

Para una vista previa mediante HTTP:

```text
python -m http.server 8765 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:8765`. Las dependencias de desarrollo no forman parte de la aplicación publicada.
