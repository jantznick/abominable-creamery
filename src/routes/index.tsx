import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { Privacy } from '../pages/Privacy';
import { Home } from '../pages/Home';
import { Flavors } from '../pages/Flavors';
import { Flavor } from '../pages/Flavor';
import { Shipping } from '../pages/Shipping';
import { Stores } from '../pages/Stores';
import { Story } from '../pages/Story';
import { Cart } from '../pages/Cart';
import { Contact } from '../pages/Contact';
import { News } from '../pages/News';
import { NotFound } from '../pages/NotFound';

import { Header } from '../components/header/Header';
import { Footer } from '../components/footer/Footer';

const AppRoutes: React.FC = (route) => {

	return (
		<>
			<Header />
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/flavors" element={<Flavors />} />
				<Route path="/flavors/:flavor" element={<Flavor />} />
				<Route path="/privacy" element={<Privacy />} />
				<Route path="/shipping" element={<Shipping />} />
				<Route path="/stores" element={<Stores />} />
				<Route path="/story" element={<Story />} />
				<Route path="/cart" element={<Cart />} />
				<Route path="/contact" element={<Contact />} />
				<Route path="/news" element={<News />} />
				<Route path="/404" element={<NotFound />} />
				<Route path="/*" element={<NotFound />} />
			</Routes>
			<Footer />
		</>
	);
}

export default AppRoutes;