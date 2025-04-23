const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
require('dotenv').config(); // Load .env file

const use = {
	test: /\.(tsx|ts)$/,
	exclude: /node_modules/,
	loader: 'babel-loader',
	options: {
		presets: [
			['@babel/preset-env', {
				targets: "defaults"
			}],
			['@babel/preset-react', { "runtime": "automatic" }],
			"@babel/preset-typescript"
		]
	}
}

const browserConfig = {
	entry: "./clientRender.tsx",
	output: {
		path: __dirname,
		filename: "./public/js/bundle.js"
	},
	devtool: "cheap-module-source-map",
	module: {
		rules: [use]
	},
	resolve: {
		extensions: ['.*', '.tsx', '.ts'],
	},
	mode: "development",
	plugins: [
		new webpack.DefinePlugin({
			// Define process.env variables for client-side code
			'process.env.STRIPE_PUBLISHABLE_KEY': JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY)
			// Add other variables here if needed, e.g.:
			// 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development') 
		}),
		new webpack.IgnorePlugin({
			resourceRegExp: /^pg-native$|^cloudflare:sockets$/,
		})
	]
};

const serverConfig = {
	entry: "./serverRender.tsx",
	target: "node",
	output: {
		path: __dirname,
		filename: "./built/server.js",
		libraryTarget: "commonjs2"
	},
	devtool: "cheap-module-source-map",
	module: {
		rules: [use]
	},
	externals: [nodeExternals()],
	resolve: {
		extensions: ['.*', '.tsx', '.ts', '.js'],
	},
	plugins: [
		new webpack.IgnorePlugin({
			resourceRegExp: /^pg-native$|^cloudflare:sockets$/,
		})
	],
	mode: "development"
};

module.exports = [browserConfig, serverConfig];