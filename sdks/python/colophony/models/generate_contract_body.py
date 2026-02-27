from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.generate_contract_body_merge_data import GenerateContractBodyMergeData





T = TypeVar("T", bound="GenerateContractBody")



@_attrs_define
class GenerateContractBody:
    """ 
        Attributes:
            pipeline_item_id (UUID): Pipeline item ID
            contract_template_id (UUID): Contract template to use
            merge_data (GenerateContractBodyMergeData | Unset): Override merge field values
     """

    pipeline_item_id: UUID
    contract_template_id: UUID
    merge_data: GenerateContractBodyMergeData | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.generate_contract_body_merge_data import GenerateContractBodyMergeData
        pipeline_item_id = str(self.pipeline_item_id)

        contract_template_id = str(self.contract_template_id)

        merge_data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.merge_data, Unset):
            merge_data = self.merge_data.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "pipelineItemId": pipeline_item_id,
            "contractTemplateId": contract_template_id,
        })
        if merge_data is not UNSET:
            field_dict["mergeData"] = merge_data

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.generate_contract_body_merge_data import GenerateContractBodyMergeData
        d = dict(src_dict)
        pipeline_item_id = UUID(d.pop("pipelineItemId"))




        contract_template_id = UUID(d.pop("contractTemplateId"))




        _merge_data = d.pop("mergeData", UNSET)
        merge_data: GenerateContractBodyMergeData | Unset
        if isinstance(_merge_data,  Unset):
            merge_data = UNSET
        else:
            merge_data = GenerateContractBodyMergeData.from_dict(_merge_data)




        generate_contract_body = cls(
            pipeline_item_id=pipeline_item_id,
            contract_template_id=contract_template_id,
            merge_data=merge_data,
        )


        generate_contract_body.additional_properties = d
        return generate_contract_body

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
