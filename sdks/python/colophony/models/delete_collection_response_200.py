from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.delete_collection_response_200_type_hint import DeleteCollectionResponse200TypeHint
from ..models.delete_collection_response_200_visibility import DeleteCollectionResponse200Visibility

T = TypeVar("T", bound="DeleteCollectionResponse200")


@_attrs_define
class DeleteCollectionResponse200:
    """
    Attributes:
        id (UUID): Collection ID
        organization_id (UUID): Organization ID
        owner_id (UUID): Owner user ID
        name (str): Collection name
        description (None | str): Collection description
        visibility (DeleteCollectionResponse200Visibility): Visibility scope of the collection
        type_hint (DeleteCollectionResponse200TypeHint): Purpose hint for the collection
        created_at (datetime.datetime): When the collection was created
        updated_at (datetime.datetime): When the collection was last updated
    """

    id: UUID
    organization_id: UUID
    owner_id: UUID
    name: str
    description: None | str
    visibility: DeleteCollectionResponse200Visibility
    type_hint: DeleteCollectionResponse200TypeHint
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        organization_id = str(self.organization_id)

        owner_id = str(self.owner_id)

        name = self.name

        description: None | str
        description = self.description

        visibility = self.visibility.value

        type_hint = self.type_hint.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "organizationId": organization_id,
                "ownerId": owner_id,
                "name": name,
                "description": description,
                "visibility": visibility,
                "typeHint": type_hint,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        organization_id = UUID(d.pop("organizationId"))

        owner_id = UUID(d.pop("ownerId"))

        name = d.pop("name")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))

        visibility = DeleteCollectionResponse200Visibility(d.pop("visibility"))

        type_hint = DeleteCollectionResponse200TypeHint(d.pop("typeHint"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))

        delete_collection_response_200 = cls(
            id=id,
            organization_id=organization_id,
            owner_id=owner_id,
            name=name,
            description=description,
            visibility=visibility,
            type_hint=type_hint,
            created_at=created_at,
            updated_at=updated_at,
        )

        delete_collection_response_200.additional_properties = d
        return delete_collection_response_200

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
