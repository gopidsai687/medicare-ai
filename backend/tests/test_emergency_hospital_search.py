"""
Comprehensive test suite for MediCare Emergency & Nearby Hospital Search Accuracy.
Validates all requirements and the 6 mandatory acceptance tests:
- TEST A: Search 37067 -> Franklin, TN area facilities (Williamson Medical Center).
- TEST B: Search 37027 -> Brentwood, TN area facilities.
- TEST C: Search 60611 -> Chicago, IL area facilities.
- TEST D: Search 10001 -> New York, NY area facilities.
- TEST E: Search invalid ZIP code -> Validation message / HTTP 400.
- TEST F: Disabled hospital search API / Outage -> Service-unavailable message, not fabricated results.
Plus:
- Strict radius filtering (no distant hospitals).
- Haversine distance accuracy.
- 24/7 Emergency Department filtering.
- Valid Directions and Tel URLs.
"""
import pytest
import os
from fastapi import HTTPException
from app.services.hospital_service import search_nearby_hospitals, calculate_distance, geocode_location


@pytest.mark.asyncio
async def test_a_search_37067_franklin_tn():
    """TEST A: Search 37067 must resolve to Franklin, TN and return local facilities, zero Chicago/NY."""
    res = await search_nearby_hospitals(query="37067", radius_miles=25.0)
    origin = res["origin"]
    assert origin["city"] == "Franklin"
    assert origin["state"] == "TN"
    assert origin["postal_code"] == "37067"
    assert abs(origin["latitude"] - 35.9278) < 0.1
    assert abs(origin["longitude"] - (-86.8034)) < 0.1

    facilities = res["facilities"]
    assert len(facilities) > 0, "Must return nearby facilities for Franklin, TN"

    # Nearest must be Williamson Medical Center in Franklin, TN
    nearest = facilities[0]
    assert "williamson" in nearest["name"].lower()
    assert nearest["city"] == "Franklin"
    assert nearest["state"] == "TN"
    assert nearest["postal_code"] == "37067"
    assert nearest["distance_miles"] < 3.0, f"Williamson Med Ctr should be ~1.2 miles away, got {nearest['distance_miles']}"
    assert nearest["has_emergency_department"] is True

    # Critical check: zero hospitals from Chicago or New York
    for f in facilities:
        assert f["state"] != "IL", f"Found Chicago/IL facility in Franklin search: {f['name']}"
        assert f["state"] != "NY", f"Found NY facility in Franklin search: {f['name']}"
        assert f["distance_miles"] <= 25.0, f"Facility {f['name']} exceeds 25 mile radius: {f['distance_miles']} mi"


@pytest.mark.asyncio
async def test_b_search_37027_brentwood_tn():
    """TEST B: Search 37027 must resolve to Brentwood, TN and return Middle TN facilities."""
    res = await search_nearby_hospitals(query="37027", radius_miles=25.0)
    origin = res["origin"]
    assert origin["city"] == "Brentwood"
    assert origin["state"] == "TN"
    assert origin["postal_code"] == "37027"

    facilities = res["facilities"]
    assert len(facilities) > 0

    # All returned facilities must be in TN and within 25 miles
    for f in facilities:
        assert f["state"] == "TN"
        assert f["distance_miles"] <= 25.0
        assert f["distance_miles"] >= 0.0

    # Should include Williamson Medical Center or TriStar Southern Hills
    names = [f["name"].lower() for f in facilities]
    assert any("williamson" in n or "southern hills" in n or "vanderbilt" in n for n in names)


@pytest.mark.asyncio
async def test_c_search_60611_chicago_il():
    """TEST C: Search 60611 must resolve to Chicago, IL and return Chicago medical centers."""
    res = await search_nearby_hospitals(query="60611", radius_miles=25.0)
    origin = res["origin"]
    assert origin["city"] == "Chicago"
    assert origin["state"] == "IL"
    assert origin["postal_code"] == "60611"

    facilities = res["facilities"]
    assert len(facilities) > 0

    # Nearest must be Northwestern Memorial Hospital in Chicago
    nearest = facilities[0]
    assert "northwestern" in nearest["name"].lower()
    assert nearest["city"] == "Chicago"
    assert nearest["distance_miles"] < 1.0

    # All returned facilities must be within 25 miles
    for f in facilities:
        assert f["state"] == "IL"
        assert f["distance_miles"] <= 25.0


@pytest.mark.asyncio
async def test_d_search_10001_new_york_ny():
    """TEST D: Search 10001 must resolve to New York, NY and return Manhattan medical centers."""
    res = await search_nearby_hospitals(query="10001", radius_miles=25.0)
    origin = res["origin"]
    assert origin["city"] == "New York"
    assert origin["state"] == "NY"
    assert origin["postal_code"] == "10001"

    facilities = res["facilities"]
    assert len(facilities) > 0

    # All returned facilities must be within 25 miles of Manhattan (NY or neighboring NJ metro)
    for f in facilities:
        assert f["state"] in ("NY", "NJ"), f"Unexpected state in Manhattan search: {f['state']} for {f['name']}"
        assert f["distance_miles"] <= 25.0

    names = [f["name"].lower() for f in facilities]
    assert any("mount sinai" in n or "langone" in n or "bellevue" in n or "presbyterian" in n for n in names)


@pytest.mark.asyncio
async def test_e_search_invalid_zip():
    """TEST E: Search an invalid ZIP code like 00000 must raise clean validation error."""
    with pytest.raises(HTTPException) as exc_info:
        await search_nearby_hospitals(query="00000", radius_miles=25.0)

    assert exc_info.value.status_code == 400
    assert "invalid zip code" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_f_simulated_api_outage():
    """TEST F: When API/service outage is simulated, returns 503 service unavailable, not fabricated results."""
    os.environ["SIMULATE_SEARCH_OUTAGE"] = "true"
    try:
        with pytest.raises(HTTPException) as exc_info:
            await search_nearby_hospitals(query="37067", radius_miles=25.0)

        assert exc_info.value.status_code == 503
        assert "unable to retrieve nearby hospitals" in exc_info.value.detail.lower()
    finally:
        os.environ.pop("SIMULATE_SEARCH_OUTAGE", None)


@pytest.mark.asyncio
async def test_strict_small_radius_filter():
    """Search 37067 with 5-mile radius must ONLY include facilities within 5 miles."""
    res = await search_nearby_hospitals(query="37067", radius_miles=5.0)
    facilities = res["facilities"]
    assert len(facilities) >= 1
    for f in facilities:
        assert f["distance_miles"] <= 5.0, f"{f['name']} is {f['distance_miles']} mi away, exceeds 5.0 mi radius!"

    # Vanderbilt (which is ~14.7 miles away) must be excluded from a 5-mile radius search
    names = [f["name"].lower() for f in facilities]
    assert not any("vanderbilt" in n for n in names), "Vanderbilt should be excluded from 5-mile radius search"


@pytest.mark.asyncio
async def test_emergency_only_filter():
    """Filter to 24/7 emergency departments only."""
    res = await search_nearby_hospitals(query="37067", radius_miles=25.0, emergency_only=True)
    facilities = res["facilities"]
    assert len(facilities) > 0
    for f in facilities:
        assert f["has_emergency_department"] is True


def test_haversine_formula_accuracy():
    """Verify mathematical distance between known GPS points."""
    # Distance between Franklin 37067 (35.9278, -86.8034) and Williamson Med Ctr (35.9163, -86.8202)
    miles, km = calculate_distance(35.9278, -86.8034, 35.9163, -86.8202)
    assert 1.0 <= miles <= 1.5, f"Expected ~1.2 miles, got {miles}"
    assert miles * 1.609 <= km <= miles * 1.611

    # Distance between Franklin TN and Chicago Northwestern (41.8953, -87.6206)
    miles_chi, _ = calculate_distance(35.9278, -86.8034, 41.8953, -87.6206)
    assert 410 <= miles_chi <= 420, f"Expected ~415 miles to Chicago, got {miles_chi}"


@pytest.mark.asyncio
async def test_call_desk_and_directions_links():
    """Verify phone link and Google Maps directions link format."""
    res = await search_nearby_hospitals(query="37067", radius_miles=25.0)
    f = res["facilities"][0]
    assert "phone" in f and f["phone"].startswith("+1")
    assert "directions_url" in f
    assert "google.com/maps/dir" in f["directions_url"]
    assert "origin=35.9278,-86.8034" in f["directions_url"]
