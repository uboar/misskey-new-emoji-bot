
export interface Env {
	ORIGIN: string
	TOKEN: string
	MISSKEY_EMOJIS: KVNamespace
}

export type Emojis = [
	{
		id?: string,
		aliases: Array<string>
		name: string
		url: string
		category: string
	}
]


const ping = async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
	const miResponse = await fetch(`${env.ORIGIN}/api/notes/create`, {
		method: 'POST',
		headers: {
			"content-type": "application/json"
		},
		body: JSON.stringify({
			i: env.TOKEN,
			localOnly: true,
			text: "botからの投稿テストです。"
		})
	})
	return new Response('ok')
}

const newEmojiNote = async (event: ScheduledController | null, env: Env, ctx: ExecutionContext) => {
	const miResponse = await fetch(`${env.ORIGIN}/api/admin/emoji/list`, {
		method: 'POST',
		headers: {
			"content-type": "application/json"
		},
		body: JSON.stringify({
			i: env.TOKEN,
			limit: 20,
		})
	})
	const emojis = await miResponse.json() as Emojis
	console.log(JSON.stringify(emojis))
	const gluedEmojiNames = await env.MISSKEY_EMOJIS.get("emojiNames") as string

	let find = -1

	emojis.forEach((elem, index) => {
		if (gluedEmojiNames.indexOf(" " + elem.name + " ") < 0) {
			find = index
		}
	})

	if (find >= 0) {
		let noteText = `新しい絵文字:${emojis[find].name}:（\`${emojis[find].name}\`）が追加されたかもしれません。`

		if ((emojis[find].category !== '') && (emojis[find].category !== null)){
			noteText += `
この絵文字は${emojis[find].category}に分類されています。`
		}

		if((emojis[find].aliases[0] !== '') && (emojis[find].aliases[0] !== null)){

			noteText += `
また、この絵文字は\`${emojis[find].aliases.join(", ")}\`でも出す事が出来ます。`
		}

		noteText += `
$[x3 :${emojis[find].name}:]`

		console.log(emojis[find].name)
		await env.MISSKEY_EMOJIS.put("emojiNames", gluedEmojiNames + emojis[find].name + " ")
		await fetch(`${env.ORIGIN}/api/notes/create`, {
			method: 'POST',
			headers: {
				"content-type": "application/json"
			},
			body: JSON.stringify({
				i: env.TOKEN,
				localOnly: true,
				text: noteText,
			})
		})
	} else {
		console.log("no new emojis")
	}
}

const syncallemojis = async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
	const miResponse = await fetch(`${env.ORIGIN}/api/emojis`, {
		method: 'POST',
		headers: {
			"content-type": "application/json"
		},
		body: JSON.stringify({
			i: env.TOKEN,
		})
	})
	

	const { emojis } = await miResponse.json() as { emojis: Emojis }


	let gluedEmojiNames = " "

	emojis.forEach((elem) => {
		gluedEmojiNames += elem.name + " "
	})

	await env.MISSKEY_EMOJIS.put("emojiNames", gluedEmojiNames);

	return new Response(gluedEmojiNames)
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {

		const url = request.url
		if (url.includes('ping')) return await ping(request, env, ctx)
		if (url.includes('syncallemojis')) return await syncallemojis(request, env, ctx)
		if (url.includes('newemojitest')) {
			await newEmojiNote(null, env, ctx)
			return new Response("ok")
		}
		return new Response("not found");
	},
	async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(newEmojiNote(event, env, ctx));
	}
};
