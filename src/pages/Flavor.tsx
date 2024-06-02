import React, { useContext } from 'react'

import { FlavorContext } from '../routes';

export const Flavor = () => {

	const {
		flavor
	} = useContext(FlavorContext)

	return (
		<div>Flavor: {flavor.name && flavor.name}</div>
	)
}
