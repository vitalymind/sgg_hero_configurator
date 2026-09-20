import { http, HttpResponse } from 'msw';
import { Hero, HeroesSyncResponse } from '@hero_manager/shared';

export const mockHeroes: Hero[] = [
	{
		uuid: '11111111-1111-1111-1111-111111111111',
		name: 'Arthur Pendragon',
		attack: 75,
		defense: 60,
		special_skill_id: 'excalibur',
		status: 'active',
	},
	{
		uuid: '22222222-2222-2222-2222-222222222222',
		name: 'Merlin the Enchanter',
		attack: 40,
		defense: 85,
		special_skill_id: 'arcane_blast',
		status: 'active',
	},
];

export const handlers = [
	// Health / Connect handshake
	http.get('*/api/connect', () => {
		return HttpResponse.json({
			user: { email: 'developer@company.com', name: 'Developer' }
		}, { status: 200 });
	}),

	// Login request OTP
	http.post('*/api/login', () => {
		return HttpResponse.json({ message: 'OTP sent' });
	}),

	// Signup request OTP
	http.post('*/api/signup', () => {
		return HttpResponse.json({ message: 'OTP sent' });
	}),

	// Login verify OTP
	http.post('*/api/login/verify', () => {
		return HttpResponse.json({ message: 'Authenticated' });
	}),

	// Logout
	http.post('*/api/logout', () => {
		return HttpResponse.json({ message: 'Logged out' });
	}),

	// Fetch heroes (delta sync)
	http.get('*/api/heroes', () => {
		const response: HeroesSyncResponse = {
			lastUpdated: 1000,
			heroes: mockHeroes,
			activeUuids: mockHeroes.map((h) => h.uuid!),
		};
		return HttpResponse.json(response);
	}),

	// Create hero
	http.post('*/api/heroes', async ({ request }) => {
		const body = (await request.json()) as Hero;
		const createdHero: Hero = {
			...body,
			uuid: '33333333-3333-3333-3333-333333333333',
			status: 'active',
		};
		return HttpResponse.json(createdHero);
	}),

	// Update hero
	http.put('*/api/heroes/:uuid', async ({ request, params }) => {
		const body = (await request.json()) as Hero;
		const updatedHero: Hero = {
			...body,
			uuid: params.uuid as string,
		};
		return HttpResponse.json(updatedHero);
	}),
];
