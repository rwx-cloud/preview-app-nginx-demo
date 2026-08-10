const button = document.querySelector('#load-object');
const apiResponse = document.querySelector('#api-response');
const objectResponse = document.querySelector('#object-response');

button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Fetching…';
  apiResponse.textContent = 'Calling /api/presigned-url…';
  objectResponse.textContent = 'Waiting for the API…';

  try {
    const apiRequest = await fetch('/api/presigned-url');
    const result = await apiRequest.json();

    if (!apiRequest.ok) throw new Error(result.error ?? 'The API request failed');

    apiResponse.textContent = JSON.stringify(result, null, 2);
    objectResponse.textContent = 'Fetching the signed URL through Nginx…';

    const objectRequest = await fetch(result.url);
    const body = await objectRequest.text();

    if (!objectRequest.ok) throw new Error(`MinIO returned ${objectRequest.status}: ${body}`);

    try {
      objectResponse.textContent = JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      objectResponse.textContent = body;
    }
  } catch (error) {
    objectResponse.textContent = error instanceof Error ? error.message : 'Unexpected error';
  } finally {
    button.disabled = false;
    button.textContent = 'Fetch again';
  }
});
