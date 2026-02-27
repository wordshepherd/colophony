from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_contracts_by_pipeline_item_response_200_item_status import ListContractsByPipelineItemResponse200ItemStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.list_contracts_by_pipeline_item_response_200_item_merge_data_type_0 import ListContractsByPipelineItemResponse200ItemMergeDataType0





T = TypeVar("T", bound="ListContractsByPipelineItemResponse200Item")



@_attrs_define
class ListContractsByPipelineItemResponse200Item:
    """ 
        Attributes:
            id (UUID): Contract ID
            organization_id (UUID): Organization ID
            pipeline_item_id (UUID): Pipeline item ID
            contract_template_id (None | UUID): Source template ID
            status (ListContractsByPipelineItemResponse200ItemStatus): Current status of the contract
            rendered_body (str): Contract body with merge fields resolved
            merge_data (ListContractsByPipelineItemResponse200ItemMergeDataType0 | None): Merge field values used
            documenso_document_id (None | str): Documenso document ID
            signed_at (datetime.datetime | None): When the contract was signed
            countersigned_at (datetime.datetime | None): When the contract was countersigned
            completed_at (datetime.datetime | None): When the contract was completed
            created_at (datetime.datetime): When the contract was created
            updated_at (datetime.datetime): When the contract was last updated
     """

    id: UUID
    organization_id: UUID
    pipeline_item_id: UUID
    contract_template_id: None | UUID
    status: ListContractsByPipelineItemResponse200ItemStatus
    rendered_body: str
    merge_data: ListContractsByPipelineItemResponse200ItemMergeDataType0 | None
    documenso_document_id: None | str
    signed_at: datetime.datetime | None
    countersigned_at: datetime.datetime | None
    completed_at: datetime.datetime | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_contracts_by_pipeline_item_response_200_item_merge_data_type_0 import ListContractsByPipelineItemResponse200ItemMergeDataType0
        id = str(self.id)

        organization_id = str(self.organization_id)

        pipeline_item_id = str(self.pipeline_item_id)

        contract_template_id: None | str
        if isinstance(self.contract_template_id, UUID):
            contract_template_id = str(self.contract_template_id)
        else:
            contract_template_id = self.contract_template_id

        status = self.status.value

        rendered_body = self.rendered_body

        merge_data: dict[str, Any] | None
        if isinstance(self.merge_data, ListContractsByPipelineItemResponse200ItemMergeDataType0):
            merge_data = self.merge_data.to_dict()
        else:
            merge_data = self.merge_data

        documenso_document_id: None | str
        documenso_document_id = self.documenso_document_id

        signed_at: None | str
        if isinstance(self.signed_at, datetime.datetime):
            signed_at = self.signed_at.isoformat()
        else:
            signed_at = self.signed_at

        countersigned_at: None | str
        if isinstance(self.countersigned_at, datetime.datetime):
            countersigned_at = self.countersigned_at.isoformat()
        else:
            countersigned_at = self.countersigned_at

        completed_at: None | str
        if isinstance(self.completed_at, datetime.datetime):
            completed_at = self.completed_at.isoformat()
        else:
            completed_at = self.completed_at

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "pipelineItemId": pipeline_item_id,
            "contractTemplateId": contract_template_id,
            "status": status,
            "renderedBody": rendered_body,
            "mergeData": merge_data,
            "documensoDocumentId": documenso_document_id,
            "signedAt": signed_at,
            "countersignedAt": countersigned_at,
            "completedAt": completed_at,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_contracts_by_pipeline_item_response_200_item_merge_data_type_0 import ListContractsByPipelineItemResponse200ItemMergeDataType0
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        pipeline_item_id = UUID(d.pop("pipelineItemId"))




        def _parse_contract_template_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                contract_template_id_type_0 = UUID(data)



                return contract_template_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        contract_template_id = _parse_contract_template_id(d.pop("contractTemplateId"))


        status = ListContractsByPipelineItemResponse200ItemStatus(d.pop("status"))




        rendered_body = d.pop("renderedBody")

        def _parse_merge_data(data: object) -> ListContractsByPipelineItemResponse200ItemMergeDataType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                merge_data_type_0 = ListContractsByPipelineItemResponse200ItemMergeDataType0.from_dict(data)



                return merge_data_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListContractsByPipelineItemResponse200ItemMergeDataType0 | None, data)

        merge_data = _parse_merge_data(d.pop("mergeData"))


        def _parse_documenso_document_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        documenso_document_id = _parse_documenso_document_id(d.pop("documensoDocumentId"))


        def _parse_signed_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                signed_at_type_0 = isoparse(data)



                return signed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        signed_at = _parse_signed_at(d.pop("signedAt"))


        def _parse_countersigned_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                countersigned_at_type_0 = isoparse(data)



                return countersigned_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        countersigned_at = _parse_countersigned_at(d.pop("countersignedAt"))


        def _parse_completed_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                completed_at_type_0 = isoparse(data)



                return completed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        completed_at = _parse_completed_at(d.pop("completedAt"))


        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        list_contracts_by_pipeline_item_response_200_item = cls(
            id=id,
            organization_id=organization_id,
            pipeline_item_id=pipeline_item_id,
            contract_template_id=contract_template_id,
            status=status,
            rendered_body=rendered_body,
            merge_data=merge_data,
            documenso_document_id=documenso_document_id,
            signed_at=signed_at,
            countersigned_at=countersigned_at,
            completed_at=completed_at,
            created_at=created_at,
            updated_at=updated_at,
        )


        list_contracts_by_pipeline_item_response_200_item.additional_properties = d
        return list_contracts_by_pipeline_item_response_200_item

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
