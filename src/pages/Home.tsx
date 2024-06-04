import React from 'react'
import { siteData } from '../utils/content'

export const Home = () => {
	return (
		<div className='grow'>{siteData.name} - {siteData.tagline}</div>
	)
}
