import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlavorContext } from '../routes'

export const MiniFlavorCard = ({flavor}) => {
	const randomNumber = Math.floor(Math.random() * 3)
	const colors = {
		0: 'green',
		1: 'pink',
		2: 'blue'
	};

	const {setFlavor} = useContext(FlavorContext);
	const navigate = useNavigate();

	const handleSelectFlavor = () => {
		console.log('clicked')
		setFlavor(flavor);
		navigate(`/flavors/${flavor.id}`);
	}

	return (
		<div onClick={handleSelectFlavor} className='flex flex-col w-1/4 p-6 m-4 rounded-lg shadow-md border-black border-2 hover:cursor-pointer'>
			<div>
				<img
					className=""
					src={flavor.imageSrc || `/images/${colors[randomNumber]}-soon.png`}
					/>
			</div>

			<div className='font-bold mt-2'>{flavor.name}</div>
			<div className=''>{flavor.simpleName}</div>

			<div className='mt-8'>
				<div className=''>{flavor.description}</div>
			</div>
		</div>
	)
}

{/* "id": "yeti-vanilla-dream",
"name": "Yeti Vanilla Dream",
"simpleName": "Vanilla",
"description": "A rich and creamy vanilla ice cream made from the finest Madagascar vanilla beans. Pure, aromatic, and timeless.",
"price": "5.99",
"hasDairy": true,
"hasEgg": true,
"withoutDairy": false,
"withoutEgg": false */}