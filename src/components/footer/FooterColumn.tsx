import React from 'react'

export const FooterColumn = ({column}) => {
	return (
		<div className='flex flex-col mx-4'>
			<div className="footer-link-title uppercase font-bold mb-4 text-lg">
				{column.title}
			</div>
			{column.links.map((link, i) => 
				<a href={link.ahref} key={i}>{link.text}</a>
			)}
		</div>
	)
}
