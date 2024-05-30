const webpack = require('webpack');

const use = {
    test: /\.(tsx|ts)$/,
    exclude: /node_modules/,
    loader: 'babel-loader',
    options: {
        presets: [
            ['@babel/preset-env', {
                targets: "defaults"
            }],
            ['@babel/preset-react', {"runtime": "automatic"}],
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
	mode: "development"
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
	resolve: {
		extensions: ['.*', '.tsx', '.ts', '.js'],
	},
	mode: "development"
};

module.exports = [browserConfig, serverConfig];