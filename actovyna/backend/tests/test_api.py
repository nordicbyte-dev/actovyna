from io import BytesIO

SAMPLE = ('Beste klant,\n\nU dient het formulier uiterlijk 15 december 2026 in te dienen. '
          'Het bedrag bedraagt € 48,50.\n\nMet vriendelijke groet.').encode('utf-8')


def test_healthy_and_empty(client):
    assert client.get('/api/health').status_code == 200
    assert client.get('/api/stats').json()['documents'] == 0


def test_upload_extract_tasks_and_delete(client):
    response = client.post('/api/documents', files={'file': ('brief.txt', BytesIO(SAMPLE), 'text/plain')})
    assert response.status_code == 201, response.text
    document = response.json()
    assert document['filename'] == 'brief.txt'
    assert document['mode'] == 'local'
    assert any(i['kind'] == 'amount' for i in document['insights'])
    detail = client.get('/api/documents/' + document['id']).json()
    assert '15 december' in detail['extracted_text']
    tasks = client.get('/api/tasks').json()
    assert len(tasks) == 1
    assert tasks[0]['due_date'] == '2026-12-15'
    assert client.patch('/api/tasks/' + tasks[0]['id'], json={'status': 'done'}).status_code == 200
    assert client.get('/api/stats').json()['done_tasks'] == 1
    assert client.delete('/api/documents/' + document['id']).status_code == 204
    assert client.get('/api/tasks').json() == []


def test_manual_task(client):
    response = client.post('/api/tasks', json={'title': 'Bel de gemeente', 'due_date': '2026-12-12'})
    assert response.status_code == 201
    task_id = response.json()['id']
    assert client.delete('/api/tasks/' + task_id).status_code == 204


def test_bad_file_and_date(client):
    bad = client.post('/api/documents', files={'file': ('evil.exe', BytesIO(b'1'), 'application/octet-stream')})
    assert bad.status_code == 415
    bad_date = client.post('/api/tasks', json={'title': 'Foo', 'due_date': 'nope'})
    assert bad_date.status_code == 422
