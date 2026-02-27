from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_issues_response_200 import ListIssuesResponse200
from ...models.list_issues_status import ListIssuesStatus
from ...types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    publication_id: UUID | Unset = UNSET,
    status: ListIssuesStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_publication_id: str | Unset = UNSET
    if not isinstance(publication_id, Unset):
        json_publication_id = str(publication_id)
    params["publicationId"] = json_publication_id

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params["search"] = search

    json_from_: str | Unset = UNSET
    if not isinstance(from_, Unset):
        json_from_ = from_.isoformat()
    params["from"] = json_from_

    json_to: str | Unset = UNSET
    if not isinstance(to, Unset):
        json_to = to.isoformat()
    params["to"] = json_to

    params["page"] = page

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/issues",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ListIssuesResponse200 | None:
    if response.status_code == 200:
        response_200 = ListIssuesResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ListIssuesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    publication_id: UUID | Unset = UNSET,
    status: ListIssuesStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListIssuesResponse200]:
    """ List issues

     Returns a paginated list of issues in the organization.

    Args:
        publication_id (UUID | Unset): Filter by publication
        status (ListIssuesStatus | Unset): Filter by status
        search (str | Unset): Search by title
        from_ (datetime.datetime | Unset): Filter issues with publicationDate >= this date
        to (datetime.datetime | Unset): Filter issues with publicationDate <= this date
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListIssuesResponse200]
     """


    kwargs = _get_kwargs(
        publication_id=publication_id,
status=status,
search=search,
from_=from_,
to=to,
page=page,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    publication_id: UUID | Unset = UNSET,
    status: ListIssuesStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListIssuesResponse200 | None:
    """ List issues

     Returns a paginated list of issues in the organization.

    Args:
        publication_id (UUID | Unset): Filter by publication
        status (ListIssuesStatus | Unset): Filter by status
        search (str | Unset): Search by title
        from_ (datetime.datetime | Unset): Filter issues with publicationDate >= this date
        to (datetime.datetime | Unset): Filter issues with publicationDate <= this date
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListIssuesResponse200
     """


    return sync_detailed(
        client=client,
publication_id=publication_id,
status=status,
search=search,
from_=from_,
to=to,
page=page,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    publication_id: UUID | Unset = UNSET,
    status: ListIssuesStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListIssuesResponse200]:
    """ List issues

     Returns a paginated list of issues in the organization.

    Args:
        publication_id (UUID | Unset): Filter by publication
        status (ListIssuesStatus | Unset): Filter by status
        search (str | Unset): Search by title
        from_ (datetime.datetime | Unset): Filter issues with publicationDate >= this date
        to (datetime.datetime | Unset): Filter issues with publicationDate <= this date
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListIssuesResponse200]
     """


    kwargs = _get_kwargs(
        publication_id=publication_id,
status=status,
search=search,
from_=from_,
to=to,
page=page,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    publication_id: UUID | Unset = UNSET,
    status: ListIssuesStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListIssuesResponse200 | None:
    """ List issues

     Returns a paginated list of issues in the organization.

    Args:
        publication_id (UUID | Unset): Filter by publication
        status (ListIssuesStatus | Unset): Filter by status
        search (str | Unset): Search by title
        from_ (datetime.datetime | Unset): Filter issues with publicationDate >= this date
        to (datetime.datetime | Unset): Filter issues with publicationDate <= this date
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListIssuesResponse200
     """


    return (await asyncio_detailed(
        client=client,
publication_id=publication_id,
status=status,
search=search,
from_=from_,
to=to,
page=page,
limit=limit,

    )).parsed
