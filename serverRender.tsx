import React from 'react';
import express, { Express, Request, Response } from 'express';
import { renderToString } from 'react-dom/server';

import { App } from './src/App';

const app: Express = express();

app.use(express.static('public'));

app.get('/', (req: Request, res: Response) => {
	res.send(`<!DOCTYPE html>
	<head>
		<title>Typescript Tailwind Shadcn Starter</title>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link href="/css/style.css" rel="stylesheet">
	</head>
	<body>
		<div id="root" class="min-h-screen flex-col flex">${renderToString(<App />)}</div>
		<script src="/js/bundle.js" defer></script>
	</body>
</html>
	`);
});

app.listen(3000, () => {
	console.log("Server running on port 3000");
});