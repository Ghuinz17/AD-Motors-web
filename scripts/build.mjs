// ============================================================
// Build de producción de AD Motors
// ------------------------------------------------------------
// - Minifica JS y CSS.
// - Minifica los <script> inline del HTML.
// - Elimina console.* y debugger.
// - No genera source maps.
// - Copia el resultado a dist/
//
// Uso: npm run build
// ============================================================

import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const root = process.cwd();
const outDir = path.join(root, "dist");

// Carpetas que no forman parte del sitio público.
const skipDirs = new Set([
  ".git",
  ".vercel",
  "dist",
  "node_modules",
  "scripts",
  "docs",
  "supabase",
]);

// Archivos de la raíz que no deben copiarse a dist.
const skipRootFiles = new Set([
  ".gitignore",
  "LICENSE",
  "README.md",
  "package-lock.json",
  "package.json",
  "vercel.json",
]);

const jsOptions = {
  loader: "js",
  minify: true,
  // Los scripts clásicos comparten variables globales entre archivos
  // (db, escapeHtml, applyFilters...). No renombrar identificadores.
  minifyIdentifiers: false,
  target: "es2020",
  drop: ["console", "debugger"],
  legalComments: "none",
  sourcemap: false,
};

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      files.push(...(await walk(path.join(dir, entry.name))));
    } else if (entry.isFile()) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

async function minifyHtml(html) {
  // Minifica solo los <script> sin atributo src.
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let result = "";
  let lastIndex = 0;

  for (const match of html.matchAll(scriptRe)) {
    result += html.slice(lastIndex, match.index);
    const attrs = match[1] || "";
    const code = match[2] || "";

    if (/\bsrc\s*=/i.test(attrs) || !code.trim()) {
      result += match[0];
    } else {
      const minified = await transform(code, jsOptions);
      result += `<script${attrs}>${minified.code}</script>`;
    }

    lastIndex = match.index + match[0].length;
  }

  result += html.slice(lastIndex);

  // Elimina comentarios HTML (no aportan nada al visitante).
  return result.replace(/<!--(?!\[if)[\s\S]*?-->/g, "");
}

async function build() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const files = await walk(root);
  let jsCount = 0;
  let cssCount = 0;
  let htmlCount = 0;

  for (const file of files) {
    const relative = path.relative(root, file);
    if (skipRootFiles.has(relative)) continue;

    const ext = path.extname(file).toLowerCase();
    const dest = path.join(outDir, relative);
    await mkdir(path.dirname(dest), { recursive: true });

    if (ext === ".js") {
      const source = await readFile(file, "utf8");
      const minified = await transform(source, jsOptions);
      await writeFile(dest, minified.code, "utf8");
      jsCount++;
    } else if (ext === ".css") {
      const source = await readFile(file, "utf8");
      const minified = await transform(source, {
        loader: "css",
        minify: true,
        target: "es2020",
        legalComments: "none",
      });
      await writeFile(dest, minified.code, "utf8");
      cssCount++;
    } else if (ext === ".html") {
      const source = await readFile(file, "utf8");
      const minified = await minifyHtml(source);
      await writeFile(dest, minified, "utf8");
      htmlCount++;
    } else {
      await cp(file, dest);
    }
  }

  console.log(
    `Build listo en dist/ — ${jsCount} JS, ${cssCount} CSS, ${htmlCount} HTML`,
  );
}

build().catch((error) => {
  console.error("Error en el build:", error);
  process.exit(1);
});
