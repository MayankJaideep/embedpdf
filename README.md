# PDF Companion

Create a small EmbedPDF POC from scratch using React + TypeScript + Vite.

Implement only these features:

PDF Upload – allow the user to select or drag-and-drop any .pdf file from their computer.

PDF Rendering – load the uploaded PDF using the current official EmbedPDF React integration and display it in the browser.

PDF Search – allow the user to search for text inside the uploaded PDF and navigate through search results.

PDF Annotation – allow basic annotations such as highlighting, underlining, notes, or drawing using EmbedPDF's built-in annotation features.

Keep it frontend-only:

No backend

No database

No authentication

No PSPDFKit

No performance comparison yet

No custom PDF rendering/search/annotation engine

Use the uploaded PDF directly in the browser. Do not upload or store the PDF on a server.

Keep the UI simple:

Upload PDF → View PDF → Search → Annotate

Use the current official EmbedPDF APIs and avoid implementing functionality that EmbedPDF already provides.

Make sure the project is clean, minimal, and runs with:

npm install
npm run dev

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/37f540de-e074-40aa-8c83-33b0f5ebea4e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
