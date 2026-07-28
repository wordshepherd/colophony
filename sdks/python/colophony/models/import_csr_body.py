from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.import_csr_body_correspondence_item import ImportCsrBodyCorrespondenceItem
    from ..models.import_csr_body_submissions_item import ImportCsrBodySubmissionsItem


T = TypeVar("T", bound="ImportCsrBody")


@_attrs_define
class ImportCsrBody:
    """
    Attributes:
        submissions (list[ImportCsrBodySubmissionsItem]):
        correspondence (list[ImportCsrBodyCorrespondenceItem] | Unset):
        imported_from (str | Unset):  Default: 'csr_import'.
    """

    submissions: list[ImportCsrBodySubmissionsItem]
    correspondence: list[ImportCsrBodyCorrespondenceItem] | Unset = UNSET
    imported_from: str | Unset = "csr_import"
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        submissions = []
        for submissions_item_data in self.submissions:
            submissions_item = submissions_item_data.to_dict()
            submissions.append(submissions_item)

        correspondence: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.correspondence, Unset):
            correspondence = []
            for correspondence_item_data in self.correspondence:
                correspondence_item = correspondence_item_data.to_dict()
                correspondence.append(correspondence_item)

        imported_from = self.imported_from

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "submissions": submissions,
            }
        )
        if correspondence is not UNSET:
            field_dict["correspondence"] = correspondence
        if imported_from is not UNSET:
            field_dict["importedFrom"] = imported_from

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.import_csr_body_correspondence_item import ImportCsrBodyCorrespondenceItem
        from ..models.import_csr_body_submissions_item import ImportCsrBodySubmissionsItem

        d = dict(src_dict)
        submissions = []
        _submissions = d.pop("submissions")
        for submissions_item_data in _submissions:
            submissions_item = ImportCsrBodySubmissionsItem.from_dict(submissions_item_data)

            submissions.append(submissions_item)

        _correspondence = d.pop("correspondence", UNSET)
        correspondence: list[ImportCsrBodyCorrespondenceItem] | Unset = UNSET
        if _correspondence is not UNSET:
            correspondence = []
            for correspondence_item_data in _correspondence:
                correspondence_item = ImportCsrBodyCorrespondenceItem.from_dict(correspondence_item_data)

                correspondence.append(correspondence_item)

        imported_from = d.pop("importedFrom", UNSET)

        import_csr_body = cls(
            submissions=submissions,
            correspondence=correspondence,
            imported_from=imported_from,
        )

        import_csr_body.additional_properties = d
        return import_csr_body

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
