from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_cms_connection_body_adapter_type import CreateCmsConnectionBodyAdapterType
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.create_cms_connection_body_config import CreateCmsConnectionBodyConfig





T = TypeVar("T", bound="CreateCmsConnectionBody")



@_attrs_define
class CreateCmsConnectionBody:
    """ 
        Attributes:
            adapter_type (CreateCmsConnectionBodyAdapterType): CMS adapter type (WORDPRESS or GHOST)
            name (str): Display name for this connection
            config (CreateCmsConnectionBodyConfig): Adapter-specific configuration (API URL, credentials, etc.)
            publication_id (UUID | Unset): Publication ID
     """

    adapter_type: CreateCmsConnectionBodyAdapterType
    name: str
    config: CreateCmsConnectionBodyConfig
    publication_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_cms_connection_body_config import CreateCmsConnectionBodyConfig
        adapter_type = self.adapter_type.value

        name = self.name

        config = self.config.to_dict()

        publication_id: str | Unset = UNSET
        if not isinstance(self.publication_id, Unset):
            publication_id = str(self.publication_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "adapterType": adapter_type,
            "name": name,
            "config": config,
        })
        if publication_id is not UNSET:
            field_dict["publicationId"] = publication_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_cms_connection_body_config import CreateCmsConnectionBodyConfig
        d = dict(src_dict)
        adapter_type = CreateCmsConnectionBodyAdapterType(d.pop("adapterType"))




        name = d.pop("name")

        config = CreateCmsConnectionBodyConfig.from_dict(d.pop("config"))




        _publication_id = d.pop("publicationId", UNSET)
        publication_id: UUID | Unset
        if isinstance(_publication_id,  Unset):
            publication_id = UNSET
        else:
            publication_id = UUID(_publication_id)




        create_cms_connection_body = cls(
            adapter_type=adapter_type,
            name=name,
            config=config,
            publication_id=publication_id,
        )


        create_cms_connection_body.additional_properties = d
        return create_cms_connection_body

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
