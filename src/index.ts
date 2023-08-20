export interface Env {
  ORIGIN: string;
  TOKEN: string;
	CHANNEL_ID: string;
  MISSKEY_EMOJIS: KVNamespace;
}

export type Emojis = {
  id: string;
  aliases: Array<string>;
  name: string;
  url: string;
  category: string;
  license: string;
}[];

const ping = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> => {
  const miResponse = await fetch(`${env.ORIGIN}/api/notes/create`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      i: env.TOKEN,
      visibility: "followers",
      localOnly: true,
      text: "投稿テストです。",
    }),
  });
  return new Response("ok");
};

const newEmojiNote = async (
  event: ScheduledController | null,
  env: Env,
  ctx: ExecutionContext
) => {
  const sinceId = (await env.MISSKEY_EMOJIS.get("sinceID")) as string;

  if (!sinceId) return new Response("no sinceId");

  const miResponse = await fetch(`${env.ORIGIN}/api/admin/emoji/list`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      i: env.TOKEN,
      sinceId: sinceId,
      limit: 1,
    }),
  });
  const emojis = (await miResponse.json()) as Emojis;
  console.log(JSON.stringify(emojis));

  if (emojis.length <= 0) {
    console.log("no new emoji");
    return new Response("no new emoji");
  } else {
    let noteText = `新しい絵文字:${emojis[0].name}:（\`${emojis[0].name}\`）が追加されました。
`;

    if (emojis[0].category !== "" && emojis[0].category !== null) {
      noteText += `この絵文字は\`${emojis[0].category}\`に分類されています。
`;
    }

    if (emojis[0].aliases[0] !== "" && emojis[0].aliases[0] !== null) {
      noteText += `また、この絵文字は\`${emojis[0].aliases.join(
        ", "
      )}\`でも出す事が出来ます。
`;
    }
    noteText += `$[x3 :${emojis[0].name}:]
`;
    if (emojis[0].license !== "" && emojis[0].license !== null) {
			const replacedMention = emojis[0].license.replaceAll("@", "@ ")
      noteText += `ライセンス： ${replacedMention}`;
    }

    console.log(emojis[0].name);
    await fetch(`${env.ORIGIN}/api/notes/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        i: env.TOKEN,
				channelId: env.CHANNEL_ID,
        text: noteText,
      }),
    });

    await env.MISSKEY_EMOJIS.put("sinceID", emojis[0].id);

    return new Response("ok");
  }
};

const setSinceId = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("sinceId");
  if (!query) return new Response("no query");
  await env.MISSKEY_EMOJIS.put("sinceID", query);
  console.log(query);
  return new Response(query);
};

const getSinceId = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> => {
  const sinceId = (await env.MISSKEY_EMOJIS.get("sinceID")) as string;

  console.log(sinceId);

  if (!sinceId) return new Response("no sinceId");
  return new Response(sinceId);
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = request.url;
    if (url.includes("ping")) return await ping(request, env, ctx);
    // if (url.includes('syncallemojis')) return await syncallemojis(request, env, ctx)
    if (url.includes("newemojicheck")) {
      await newEmojiNote(null, env, ctx);
      return new Response("ok");
    }
    if (url.includes("setSinceId")) return await setSinceId(request, env, ctx);
    if (url.includes("getSinceId")) return await getSinceId(request, env, ctx);

    return new Response("not found");
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(newEmojiNote(event, env, ctx));
  },
};
