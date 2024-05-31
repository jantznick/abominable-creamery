import React from 'react';
import { siteData } from './utils/content';

export const App = () => {

	return (
		<div>{siteData.name} - {siteData.tagline}</div>
	)
}
