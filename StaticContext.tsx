import React from 'react';
import { createContext, useContext } from 'react';

const StaticContext = createContext({});

const StaticProvider = ({ children, value }) => {
	return (
		<StaticContext.Provider value={value}>
			{children}
		</StaticContext.Provider>
	)
}

const useStaticContext = () => useContext(StaticContext);

export { StaticProvider, useStaticContext };