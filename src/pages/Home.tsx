import React from 'react'
import { siteData } from '../utils/content'

export const Home = () => {
	return (
		<div>{siteData.name} - {siteData.tagline}</div>
	)
}
