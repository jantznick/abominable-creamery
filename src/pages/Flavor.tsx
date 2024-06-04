import React from 'react'

import { useParams } from 'react-router-dom';
import { flavors } from '../utils/content';

export const Flavor = () => {

	const {
		flavor
	} = useParams()

	const flavorData = flavors.find(flavorD => flavorD.id == flavor);

	return (
		<div className='grow'>Flavor: {flavorData.name && flavorData.name}</div>
	)
}
