def test_health_is_public(inventory_client):
    response = inventory_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
