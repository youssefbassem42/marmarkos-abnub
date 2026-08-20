"""Media asset metadata persistence tests."""

from app.modules.media.domain.enums.media_asset_type import MediaAssetType
from app.modules.media.infrastructure.persistence.models import MediaAsset
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def test_media_asset_creation(uow: UnitOfWork, db_session) -> None:
    admin = await make_user(uow, "media-admin@example.com")
    await uow.commit()

    asset = await uow.media.create(
        name="hero-banner.jpg",
        type=MediaAssetType.IMAGE,
        url="https://storage.example.com/hero-banner.jpg",
        section="landing-hero",
        alt_text="Church gathering",
        sort_order=1,
        created_by=admin.id,
    )
    await uow.commit()

    stored = await uow.media.get_by_id(asset.id)
    assert stored is not None
    assert stored.url.endswith("hero-banner.jpg")
    assert stored.section == "landing-hero"
    assert stored.is_active is True


async def test_list_active_filtered_by_section(uow: UnitOfWork) -> None:
    await uow.media.create(
        name="a1", type=MediaAssetType.IMAGE, url="https://x/a1.jpg", section="hero"
    )
    await uow.media.create(
        name="a2", type=MediaAssetType.IMAGE, url="https://x/a2.jpg", section="hero"
    )
    await uow.media.create(
        name="b1", type=MediaAssetType.VIDEO, url="https://x/b1.mp4", section="about"
    )
    await uow.commit()

    hero = await uow.media.list_active(section="hero")
    assert {a.name for a in hero} == {"a1", "a2"}
    all_active = await uow.media.list_active()
    assert len(all_active) == 3


async def test_deactivate_asset(uow: UnitOfWork) -> None:
    asset = await uow.media.create(
        name="gone", type=MediaAssetType.IMAGE, url="https://x/gone.jpg", section="hero"
    )
    await uow.commit()

    await uow.media.set_active(asset, is_active=False)
    await uow.commit()

    assert await uow.media.list_active() == []


async def test_storage_url_never_binary(uow: UnitOfWork, db_session) -> None:
    """Only metadata and URLs are stored; no BLOB column exists."""
    from sqlalchemy import inspect

    columns = {
        column.name: column.type.__class__.__name__ for column in inspect(MediaAsset).columns
    }
    assert "url" in columns
    assert "type" in columns
    binary_types = {"LargeBinary", "BLOB", "BYTEA"}
    assert binary_types.isdisjoint(columns.values())
