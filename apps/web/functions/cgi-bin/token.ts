import { jsonResponse, MP_HOST } from '../utils'

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const response = await fetch(
    `${MP_HOST}${context.functionPath}${url.search}`,
    {
      method: 'GET',
    },
  )
  const json = await response.json()
  return jsonResponse(json)
}