from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListPeriodsResponse200ItemsItem")



@_attrs_define
class ListPeriodsResponse200ItemsItem:
    """ 
        Attributes:
            id (UUID): Unique identifier for the submission period
            organization_id (UUID): ID of the owning organization
            name (str): Display name of the period
            description (None | str): Optional description of the period
            opens_at (datetime.datetime): When submissions open
            closes_at (datetime.datetime): When submissions close
            fee (float | None): Submission fee in cents (null = free)
            max_submissions (float | None): Max submissions allowed (null = unlimited)
            form_definition_id (None | UUID): ID of the form definition linked to this period
            sim_sub_prohibited (bool): Whether simultaneous submissions are prohibited
            created_at (datetime.datetime): When the period was created
            updated_at (datetime.datetime): When the period was last updated
     """

    id: UUID
    organization_id: UUID
    name: str
    description: None | str
    opens_at: datetime.datetime
    closes_at: datetime.datetime
    fee: float | None
    max_submissions: float | None
    form_definition_id: None | UUID
    sim_sub_prohibited: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        organization_id = str(self.organization_id)

        name = self.name

        description: None | str
        description = self.description

        opens_at = self.opens_at.isoformat()

        closes_at = self.closes_at.isoformat()

        fee: float | None
        fee = self.fee

        max_submissions: float | None
        max_submissions = self.max_submissions

        form_definition_id: None | str
        if isinstance(self.form_definition_id, UUID):
            form_definition_id = str(self.form_definition_id)
        else:
            form_definition_id = self.form_definition_id

        sim_sub_prohibited = self.sim_sub_prohibited

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "name": name,
            "description": description,
            "opensAt": opens_at,
            "closesAt": closes_at,
            "fee": fee,
            "maxSubmissions": max_submissions,
            "formDefinitionId": form_definition_id,
            "simSubProhibited": sim_sub_prohibited,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        name = d.pop("name")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        opens_at = isoparse(d.pop("opensAt"))




        closes_at = isoparse(d.pop("closesAt"))




        def _parse_fee(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        fee = _parse_fee(d.pop("fee"))


        def _parse_max_submissions(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        max_submissions = _parse_max_submissions(d.pop("maxSubmissions"))


        def _parse_form_definition_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                form_definition_id_type_0 = UUID(data)



                return form_definition_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        form_definition_id = _parse_form_definition_id(d.pop("formDefinitionId"))


        sim_sub_prohibited = d.pop("simSubProhibited")

        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        list_periods_response_200_items_item = cls(
            id=id,
            organization_id=organization_id,
            name=name,
            description=description,
            opens_at=opens_at,
            closes_at=closes_at,
            fee=fee,
            max_submissions=max_submissions,
            form_definition_id=form_definition_id,
            sim_sub_prohibited=sim_sub_prohibited,
            created_at=created_at,
            updated_at=updated_at,
        )


        list_periods_response_200_items_item.additional_properties = d
        return list_periods_response_200_items_item

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
