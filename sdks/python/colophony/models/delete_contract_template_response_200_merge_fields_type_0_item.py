from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.delete_contract_template_response_200_merge_fields_type_0_item_source import DeleteContractTemplateResponse200MergeFieldsType0ItemSource
from ..types import UNSET, Unset






T = TypeVar("T", bound="DeleteContractTemplateResponse200MergeFieldsType0Item")



@_attrs_define
class DeleteContractTemplateResponse200MergeFieldsType0Item:
    """ 
        Attributes:
            key (str): Merge field key (e.g. author_name)
            label (str): Human-readable label
            source (DeleteContractTemplateResponse200MergeFieldsType0ItemSource): Whether the field is auto-populated or
                manually entered
            default_value (str | Unset): Default value if not provided
     """

    key: str
    label: str
    source: DeleteContractTemplateResponse200MergeFieldsType0ItemSource
    default_value: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        label = self.label

        source = self.source.value

        default_value = self.default_value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "key": key,
            "label": label,
            "source": source,
        })
        if default_value is not UNSET:
            field_dict["defaultValue"] = default_value

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        label = d.pop("label")

        source = DeleteContractTemplateResponse200MergeFieldsType0ItemSource(d.pop("source"))




        default_value = d.pop("defaultValue", UNSET)

        delete_contract_template_response_200_merge_fields_type_0_item = cls(
            key=key,
            label=label,
            source=source,
            default_value=default_value,
        )


        delete_contract_template_response_200_merge_fields_type_0_item.additional_properties = d
        return delete_contract_template_response_200_merge_fields_type_0_item

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
