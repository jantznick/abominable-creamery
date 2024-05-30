import React from 'react';

import { Button } from "./components/ui/button"

// import {
// 	Select,
// 	SelectContent,
// 	SelectItem,
// 	SelectTrigger,
// 	SelectValue,
// } from "./components/ui/select"

import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
  } from "./components/ui/card"
  

import { Calendar } from "./components/ui/calendar"

export const App = () => {
	const [date, setDate] = React.useState<Date | undefined>(new Date())

	return (
		<>
			<h1>Hello World!</h1>
			<Button variant="outline">Button</Button>
			{/* <Select>
				<SelectTrigger className="w-[180px]">
					<SelectValue placeholder="Theme" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="light">Light</SelectItem>
					<SelectItem value="dark">Dark</SelectItem>
					<SelectItem value="system">System</SelectItem>
				</SelectContent>
			</Select> */}
			<Calendar
				mode="single"
				selected={date}
				onSelect={setDate}
				className="rounded-md border"
			/>
			<Card>
			<CardHeader>
				<CardTitle>Card Title</CardTitle>
				<CardDescription>Card Description</CardDescription>
			</CardHeader>
			<CardContent>
				<p>Card Content</p>
			</CardContent>
			<CardFooter>
				<p>Card Footer</p>
			</CardFooter>
			</Card>
		</>
	)
}
