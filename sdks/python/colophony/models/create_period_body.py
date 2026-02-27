from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="CreatePeriodBody")



@_attrs_define
class CreatePeriodBody:
    """ 
        Attributes:
            name (str): Display name for the submission period
            opens_at (datetime.datetime): When submissions open (ISO-8601)
            closes_at (datetime.datetime): When submissions close (ISO-8601)
            description (str | Unset): Description of the period (max 2,000 chars)
            fee (float | Unset): Submission fee in cents (omit for free)
            max_submissions (int | Unset): Maximum number of submissions (omit for unlimited)
            form_definition_id (UUID | Unset): Form definition to link to this period
            sim_sub_prohibited (bool | Unset): Whether simultaneous submissions are prohibited (default: false)
     """

    name: str
    opens_at: datetime.datetime
    closes_at: datetime.datetime
    description: str | Unset = UNSET
    fee: float | Unset = UNSET
    max_submissions: int | Unset = UNSET
    form_definition_id: UUID | Unset = UNSET
    sim_sub_prohibited: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        opens_at = self.opens_at.isoformat()

        closes_at = self.closes_at.isoformat()

        description = self.description

        fee = self.fee

        max_submissions = self.max_submissions

        form_definition_id: str | Unset = UNSET
        if not isinstance(self.form_definition_id, Unset):
            form_definition_id = str(self.form_definition_id)

        sim_sub_prohibited = self.sim_sub_prohibited


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "opensAt": opens_at,
            "closesAt": closes_at,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if fee is not UNSET:
            field_dict["fee"] = fee
        if max_submissions is not UNSET:
            field_dict["maxSubmissions"] = max_submissions
        if form_definition_id is not UNSET:
            field_dict["formDefinitionId"] = form_definition_id
        if sim_sub_prohibited is not UNSET:
            field_dict["simSubProhibited"] = sim_sub_prohibited

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        opens_at = isoparse(d.pop("opensAt"))




        closes_at = isoparse(d.pop("closesAt"))




        description = d.pop("description", UNSET)

        fee = d.pop("fee", UNSET)

        max_submissions = d.pop("maxSubmissions", UNSET)

        _form_definition_id = d.pop("formDefinitionId", UNSET)
        form_definition_id: UUID | Unset
        if isinstance(_form_definition_id,  Unset):
            form_definition_id = UNSET
        else:
            form_definition_id = UUID(_form_definition_id)




        sim_sub_prohibited = d.pop("simSubProhibited", UNSET)

        create_period_body = cls(
            name=name,
            opens_at=opens_at,
            closes_at=closes_at,
            description=description,
            fee=fee,
            max_submissions=max_submissions,
            form_definition_id=form_definition_id,
            sim_sub_prohibited=sim_sub_prohibited,
        )


        create_period_body.additional_properties = d
        return create_period_body

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
