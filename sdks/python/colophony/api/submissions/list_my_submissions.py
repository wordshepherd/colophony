from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_my_submissions_response_200 import ListMySubmissionsResponse200
from ...models.list_my_submissions_status import ListMySubmissionsStatus
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    status: ListMySubmissionsStatus | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    json_submission_period_id: str | Unset = UNSET
    if not isinstance(submission_period_id, Unset):
        json_submission_period_id = str(submission_period_id)
    params["submissionPeriodId"] = json_submission_period_id

    params["search"] = search

    params["page"] = page

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/submissions/mine",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ListMySubmissionsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListMySubmissionsResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ListMySubmissionsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    status: ListMySubmissionsStatus | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListMySubmissionsResponse200]:
    """ List my submissions

     Returns submissions created by the authenticated user in the current organization.

    Args:
        status (ListMySubmissionsStatus | Unset): Filter by submission status
        submission_period_id (UUID | Unset): Filter by submission period
        search (str | Unset): Full-text search query (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListMySubmissionsResponse200]
     """


    kwargs = _get_kwargs(
        status=status,
submission_period_id=submission_period_id,
search=search,
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
    status: ListMySubmissionsStatus | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListMySubmissionsResponse200 | None:
    """ List my submissions

     Returns submissions created by the authenticated user in the current organization.

    Args:
        status (ListMySubmissionsStatus | Unset): Filter by submission status
        submission_period_id (UUID | Unset): Filter by submission period
        search (str | Unset): Full-text search query (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListMySubmissionsResponse200
     """


    return sync_detailed(
        client=client,
status=status,
submission_period_id=submission_period_id,
search=search,
page=page,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    status: ListMySubmissionsStatus | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListMySubmissionsResponse200]:
    """ List my submissions

     Returns submissions created by the authenticated user in the current organization.

    Args:
        status (ListMySubmissionsStatus | Unset): Filter by submission status
        submission_period_id (UUID | Unset): Filter by submission period
        search (str | Unset): Full-text search query (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListMySubmissionsResponse200]
     """


    kwargs = _get_kwargs(
        status=status,
submission_period_id=submission_period_id,
search=search,
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
    status: ListMySubmissionsStatus | Unset = UNSET,
    submission_period_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListMySubmissionsResponse200 | None:
    """ List my submissions

     Returns submissions created by the authenticated user in the current organization.

    Args:
        status (ListMySubmissionsStatus | Unset): Filter by submission status
        submission_period_id (UUID | Unset): Filter by submission period
        search (str | Unset): Full-text search query (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListMySubmissionsResponse200
     """


    return (await asyncio_detailed(
        client=client,
status=status,
submission_period_id=submission_period_id,
search=search,
page=page,
limit=limit,

    )).parsed
