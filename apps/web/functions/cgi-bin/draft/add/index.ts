import { jsonResponse, MP_HOST } from '../../../utils'

export const onRequestPost: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const response = await fetch(
    `${MP_HOST}${context.functionPath}${url.search}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: context.request.body,
    },
  )
  const json = await response.json()
  return jsonResponse(json)
}