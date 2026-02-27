from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.update_cms_connection_body_config import UpdateCmsConnectionBodyConfig





T = TypeVar("T", bound="UpdateCmsConnectionBody")



@_attrs_define
class UpdateCmsConnectionBody:
    """ 
        Attributes:
            name (str | Unset):
            config (UpdateCmsConnectionBodyConfig | Unset):
            is_active (bool | Unset):
     """

    name: str | Unset = UNSET
    config: UpdateCmsConnectionBodyConfig | Unset = UNSET
    is_active: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_cms_connection_body_config import UpdateCmsConnectionBodyConfig
        name = self.name

        config: dict[str, Any] | Unset = UNSET
        if not isinstance(self.config, Unset):
            config = self.config.to_dict()

        is_active = self.is_active


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if config is not UNSET:
            field_dict["config"] = config
        if is_active is not UNSET:
            field_dict["isActive"] = is_active

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_cms_connection_body_config import UpdateCmsConnectionBodyConfig
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        _config = d.pop("config", UNSET)
        config: UpdateCmsConnectionBodyConfig | Unset
        if isinstance(_config,  Unset):
            config = UNSET
        else:
            config = UpdateCmsConnectionBodyConfig.from_dict(_config)




        is_active = d.pop("isActive", UNSET)

        update_cms_connection_body = cls(
            name=name,
            config=config,
            is_active=is_active,
        )


        update_cms_connection_body.additional_properties = d
        return update_cms_connection_body

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
