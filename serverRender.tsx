import React from 'react';
import express, { Express, Request, Response } from 'express';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';

import { StaticProvider } from './StaticContext';

import AppRoutes from './src/routes/index';

import { siteData } from './src/utils/content';

const app: Express = express();

app.use(express.static('public'));

app.use("*", (req, res, next) => {
	next()
})

app.get('*', (req: Request, res: Response) => {
	res.send(`<!DOCTYPE html>
	<head>
		<title>${siteData.name} - ${siteData.tagline}</title>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link href="/css/style.css" rel="stylesheet">
	</head>
	<body>
		<div id="root" class="min-h-screen flex-col flex">${renderToString(
		<StaticRouter location={req.url} >
			<AppRoutes route={req.url} />
		</StaticRouter>)}
		</div>
		<script src="/js/bundle.js" defer></script>
	</body>
</html>
	`);
});

app.listen(3000, () => {
	console.log("Server running on port 3000");
});